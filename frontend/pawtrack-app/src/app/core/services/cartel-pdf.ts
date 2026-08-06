import { ApplicationRef, EnvironmentInjector, Injectable, createComponent } from '@angular/core';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { CartelReporte } from '../models/cartel-reporte.model';
import { CartelTemplateComponent } from '../cartel/cartel-template.component';

@Injectable({
  providedIn: 'root'
})
export class CartelPdf {

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector,
  ) {}

  /**
   * Misma firma que la versión anterior (dibujada a mano con jsPDF) —
   * los componentes que ya llaman a este servicio no necesitan cambios.
   *
   * Ahora, en vez de dibujar rectángulos/texto por coordenadas, renderiza
   * el cartel como un componente Angular normal (con Tailwind real),
   * lo captura como imagen de alta resolución con html2canvas, y esa
   * imagen se mete como página única en el PDF.
   */
  async descargarCartel(datos: CartelReporte): Promise<void> {
    const imagenResuelta = await this.resolverImagen(datos.imagen);

    const contenedor = this.crearContenedorOculto();

    const componentRef = createComponent(CartelTemplateComponent, {
      environmentInjector: this.injector,
      hostElement: contenedor,
    });

    componentRef.instance.datos = datos;
    componentRef.instance.imagenResuelta = imagenResuelta;

    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();

    try {
      // Esperamos a que las imágenes (logo, foto real) terminen de cargar
      // antes de capturar, si no, salen en blanco en el PDF.
      await this.esperarImagenes(contenedor);

      const elementoCartel = contenedor.firstElementChild as HTMLElement;

      const escalaCaptura = 2; // debe coincidir con el "scale" de html2canvas de arriba

      const canvas = await html2canvas(elementoCartel, {
        scale: escalaCaptura, // resolución alta para que se vea nítido al imprimir
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imagenDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // El tamaño de PÁGINA debe ser el tamaño LÓGICO (sin el x2 de la
      // captura), si no, la "hoja" queda físicamente enorme y el visor
      // de PDF la abre con un zoom gigante mostrando solo un pedazo.
      // La nitidez sigue intacta porque la imagen de alta resolución
      // se sigue dibujando completa, solo que reducida al tamaño de
      // página correcto — no se pierde calidad, solo se reescala.
      // Usamos "mm" en vez de "px": la unidad px de jsPDF la interpretan
      // distinto varios visores de PDF (Edge, Acrobat), y eso era lo que
      // causaba que se abriera con un zoom rarísimo. "mm" es la unidad
      // nativa de jsPDF y no da ese problema.
      const PX_A_MM = 25.4 / 96; // 96 DPI estándar de pantalla

      const anchoPagina = (canvas.width / escalaCaptura) * PX_A_MM;
      const altoPagina = (canvas.height / escalaCaptura) * PX_A_MM;

      const doc = new jsPDF({
        orientation: anchoPagina > altoPagina ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [anchoPagina, altoPagina],
      });

      doc.addImage(
        imagenDataUrl,
        'JPEG',
        0,
        0,
        anchoPagina,
        altoPagina
      );

      const folioArchivo = this.limpiarNombreArchivo(datos.folio || 'reporte');

      doc.save(`cartel-${folioArchivo}.pdf`);
    } finally {
      // Limpieza: el componente y su contenedor eran solo temporales.
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      contenedor.remove();
    }
  }

  private crearContenedorOculto(): HTMLDivElement {
    const contenedor = document.createElement('div');

    // Fuera de la pantalla visible, pero SIGUE renderizado en el DOM
    // (display:none haría que html2canvas capture todo en blanco).
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-9999px';
    contenedor.style.top = '0';
    contenedor.style.zIndex = '-1';

    document.body.appendChild(contenedor);

    return contenedor;
  }

  private esperarImagenes(contenedor: HTMLElement): Promise<void> {
    const imagenes = Array.from(contenedor.querySelectorAll('img'));

    if (imagenes.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      imagenes.map((img) => {
        if (img.complete) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          // Si una imagen falla (ej. 404 o CORS), no bloqueamos el PDF completo.
          img.onerror = () => resolve();
        });
      })
    ).then(() => undefined);
  }

  /**
   * Resuelve la imagen a algo que un <img> pueda cargar directo:
   * - File → dataURL (FileReader)
   * - URL que es el placeholder genérico → null (para mostrar el
   *   mensaje "Fotografía no disponible" en vez del ícono feo)
   * - URL normal → se regresa tal cual, el <img> la carga
   */
  private async resolverImagen(
    imagen: File | string | null | undefined
  ): Promise<string | null> {
    if (!imagen) return null;

    let urlFinal: string;

    if (imagen instanceof File) {
      urlFinal = await this.archivoADataUrl(imagen);
    } else if (imagen.toLocaleLowerCase('es-MX').includes('placeholder')) {
      return null;
    } else {
      urlFinal = imagen;
    }

    // Como la foto se pinta como background-image (no <img>), el
    // esperarImagenes() de más abajo no la detecta. La precargamos
    // aquí para que ya esté en caché del navegador antes de renderizar
    // el componente y capturarlo.
    await this.precargarImagen(urlFinal);

    return urlFinal;
  }

  private precargarImagen(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve();
      img.onerror = () => resolve(); // no bloquear el cartel si la foto falla
      img.src = url;
    });
  }

  private archivoADataUrl(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();

      lector.onload = () => {
        if (typeof lector.result === 'string') {
          resolve(lector.result);
        } else {
          reject(new Error('No se pudo leer el archivo de imagen.'));
        }
      };

      lector.onerror = () => {
        reject(lector.error || new Error('No se pudo leer la imagen.'));
      };

      lector.readAsDataURL(archivo);
    });
  }

  private limpiarNombreArchivo(valor: string): string {
    return valor
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
  }
}