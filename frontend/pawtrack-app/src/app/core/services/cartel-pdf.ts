import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

import { CartelReporte } from '../models/cartel-reporte.model';

interface MensajeCondicion {
  etiqueta: string;
  titulo: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartelPdf {

  async descargarCartel(
    datos: CartelReporte
  ): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const anchoPagina =
      doc.internal.pageSize.getWidth();

    const altoPagina =
      doc.internal.pageSize.getHeight();

    /*
     * Se dibuja primero para que quede detrás
     * del resto del contenido.
     */
    this.dibujarBurbujasDecorativas(
      doc,
      anchoPagina,
      altoPagina
    );

    /*
     * Si el logo no puede cargarse, el cartel
     * se sigue generando únicamente con el texto.
     */
    let logoPawTrack: string | null = null;

    try {
      logoPawTrack =
        await this.urlADataUrl(
          'assets/icon/pawtrack-logo.png'
        );
    } catch (error) {
      console.warn(
        'No se pudo cargar el logo de PawTrack:',
        error
      );
    }

    this.dibujarEncabezado(
      doc,
      logoPawTrack
    );

    this.dibujarMensajePrincipal(
      doc,
      datos,
      anchoPagina
    );

    await this.dibujarFotografia(
      doc,
      datos.imagen
    );

    this.dibujarDatosRapidos(
      doc,
      datos,
      anchoPagina
    );

    this.dibujarUbicacion(
      doc,
      datos,
      anchoPagina
    );

    this.dibujarDescripcion(
      doc,
      datos,
      anchoPagina
    );

    this.dibujarContacto(
      doc,
      datos,
      anchoPagina
    );

    /*
     * Se conserva el talón recortable.
     */
    this.dibujarTalones(
      doc,
      datos,
      anchoPagina,
      altoPagina
    );

    const folioArchivo =
      this.limpiarNombreArchivo(
        datos.folio || 'reporte'
      );

    doc.save(
      `cartel-${folioArchivo}.pdf`
    );
  }


  private dibujarBurbujasDecorativas(
    doc: jsPDF,
    anchoPagina: number,
    altoPagina: number
  ): void {
    // Superior derecha.
    doc.setFillColor(220, 235, 255);

    doc.circle(
      anchoPagina + 1,
      12,
      31,
      'F'
    );

    doc.setFillColor(183, 216, 255);

    doc.circle(
      anchoPagina - 24,
      3,
      14,
      'F'
    );

    doc.setFillColor(236, 245, 255);

    doc.circle(
      anchoPagina - 6,
      50,
      12,
      'F'
    );

    // Lateral izquierda.
    doc.setFillColor(232, 243, 255);

    doc.circle(
      0,
      103,
      25,
      'F'
    );

    doc.setFillColor(196, 224, 255);

    doc.circle(
      10,
      126,
      10,
      'F'
    );

    // Inferior derecha.
    doc.setFillColor(220, 235, 255);

    doc.circle(
      anchoPagina + 2,
      altoPagina - 45,
      31,
      'F'
    );

    doc.setFillColor(185, 218, 255);

    doc.circle(
      anchoPagina - 25,
      altoPagina - 20,
      13,
      'F'
    );

    // Inferior izquierda.
    doc.setFillColor(237, 245, 255);

    doc.circle(
      10,
      altoPagina - 25,
      18,
      'F'
    );
  }


  private dibujarEncabezado(
    doc: jsPDF,
    logoPawTrack: string | null
  ): void {
    const logoX = 15;
    const logoY = 9;
    const logoTamano = 11;

    if (logoPawTrack) {
      doc.addImage(
        logoPawTrack,
        'PNG',
        logoX,
        logoY,
        logoTamano,
        logoTamano,
        undefined,
        'FAST'
      );
    }

    const textoX =
      logoPawTrack
        ? logoX + logoTamano + 4
        : logoX;

    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(16);

    doc.text(
      'PAW TRACK',
      textoX,
      16.5
    );

    doc.setTextColor(
      71,
      91,
      118
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(7.5);

    doc.text(
      'Ayudamos a reunir animales con quienes los buscan',
      textoX,
      22
    );

    /*
     * El folio superior fue eliminado.
     * Solo se mantiene en los talones inferiores.
     */
  }


  private dibujarMensajePrincipal(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number
  ): void {
    const mensaje =
      this.obtenerMensajeCondicion(
        datos.condicionAnimal
      );

    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(10);

    doc.text(
      mensaje.etiqueta,
      anchoPagina / 2,
      35,
      {
        align: 'center'
      }
    );

    doc.setTextColor(
      15,
      31,
      61
    );

    doc.setFontSize(18);

    const lineasTitulo =
      doc.splitTextToSize(
        mensaje.titulo,
        180
      );

    doc.text(
      lineasTitulo,
      anchoPagina / 2,
      44,
      {
        align: 'center'
      }
    );

    const nombreCaso =
      this.formatoTitulo(
        datos.nombreCaso ||
        `${datos.tipoAnimal || 'Animal'} reportado`
      );

    doc.setFontSize(14);
    doc.setTextColor(
      26,
      39,
      62
    );

    doc.text(
      nombreCaso,
      anchoPagina / 2,
      55,
      {
        align: 'center'
      }
    );
  }


  private async dibujarFotografia(
    doc: jsPDF,
    imagen: File | string | null | undefined
  ): Promise<void> {
    const x = 24;
    const y = 63;
    const ancho = 162;
    const alto = 92;

    // Sombra.
    doc.setFillColor(
      199,
      212,
      230
    );

    doc.roundedRect(
      x + 2,
      y + 2,
      ancho,
      alto,
      7,
      7,
      'F'
    );

    // Fondo y marco.
    doc.setFillColor(
      255,
      255,
      255
    );

    doc.roundedRect(
      x,
      y,
      ancho,
      alto,
      7,
      7,
      'F'
    );

    doc.setDrawColor(
      0,
      88,
      190
    );

    doc.setLineWidth(0.8);

    doc.roundedRect(
      x,
      y,
      ancho,
      alto,
      7,
      7,
      'S'
    );

    if (!imagen) {
      this.dibujarPlaceholderImagen(
        doc,
        x,
        y,
        ancho,
        alto
      );

      return;
    }

    try {
      const imagenPreparada =
        await this.convertirImagenParaPdf(
          imagen,
          1200,
          700
        );

      doc.addImage(
        imagenPreparada,
        'JPEG',
        x + 3,
        y + 3,
        ancho - 6,
        alto - 6,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.error(
        'No se pudo cargar la fotografía del cartel:',
        error
      );

      this.dibujarPlaceholderImagen(
        doc,
        x,
        y,
        ancho,
        alto
      );
    }
  }


  private dibujarPlaceholderImagen(
    doc: jsPDF,
    x: number,
    y: number,
    ancho: number,
    alto: number
  ): void {
    doc.setFillColor(
      239,
      245,
      252
    );

    doc.roundedRect(
      x + 3,
      y + 3,
      ancho - 6,
      alto - 6,
      5,
      5,
      'F'
    );

    doc.setTextColor(
      95,
      115,
      140
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(15);

    doc.text(
      'Fotografía no disponible',
      x + ancho / 2,
      y + alto / 2,
      {
        align: 'center'
      }
    );
  }


  private dibujarDatosRapidos(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number
  ): void {
    const margen = 16;
    const separacion = 5;

    const anchoTarjeta =
      (
        anchoPagina -
        margen * 2 -
        separacion * 2
      ) / 3;

    const y = 163;
    const alto = 23;

    this.dibujarFichaRapida(
      doc,
      'A',
      'Animal',
      datos.tipoAnimal ||
        'Sin especificar',
      margen,
      y,
      anchoTarjeta,
      alto
    );

    this.dibujarFichaRapida(
      doc,
      'T',
      'Tamaño',
      datos.tamanoAnimal ||
        'Sin especificar',
      margen +
        anchoTarjeta +
        separacion,
      y,
      anchoTarjeta,
      alto
    );

    this.dibujarFichaRapida(
      doc,
      'C',
      'Condición',
      datos.condicionAnimal ||
        'Sin especificar',
      margen +
        (
          anchoTarjeta +
          separacion
        ) * 2,
      y,
      anchoTarjeta,
      alto
    );
  }


  private dibujarFichaRapida(
    doc: jsPDF,
    inicial: string,
    etiqueta: string,
    valor: string,
    x: number,
    y: number,
    ancho: number,
    alto: number
  ): void {
    // Sombra.
    doc.setFillColor(
      207,
      219,
      236
    );

    doc.roundedRect(
      x + 1.2,
      y + 1.2,
      ancho,
      alto,
      5,
      5,
      'F'
    );

    // Fondo.
    doc.setFillColor(
      243,
      248,
      255
    );

    doc.roundedRect(
      x,
      y,
      ancho,
      alto,
      5,
      5,
      'F'
    );

    // Contorno.
    doc.setDrawColor(
      190,
      214,
      243
    );

    doc.setLineWidth(0.4);

    doc.roundedRect(
      x,
      y,
      ancho,
      alto,
      5,
      5,
      'S'
    );

    // Icono circular.
    doc.setFillColor(
      0,
      88,
      190
    );

    doc.circle(
      x + 8,
      y + alto / 2,
      4.5,
      'F'
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(7.5);

    doc.text(
      inicial,
      x + 8,
      y + alto / 2 + 2.3,
      {
        align: 'center'
      }
    );

    // Etiqueta.
    doc.setTextColor(
      108,
      126,
      151
    );

    doc.setFontSize(6.3);

    doc.text(
      etiqueta.toLocaleUpperCase(
        'es-MX'
      ),
      x + 15,
      y + 8
    );

    // Valor.
    const texto =
      this.formatoTitulo(valor);

    let tamanoFuente = 9.5;

    doc.setFontSize(
      tamanoFuente
    );

    while (
      doc.getTextWidth(texto) >
        ancho - 19 &&
      tamanoFuente > 6.5
    ) {
      tamanoFuente -= 0.5;

      doc.setFontSize(
        tamanoFuente
      );
    }

    doc.setTextColor(
      0,
      65,
      145
    );

    doc.text(
      texto,
      x + 15,
      y + 16
    );
  }


  private dibujarUbicacion(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number
  ): void {
    const direccion =
      datos.direccion?.trim() ||
      'Ubicación no especificada';

    doc.setFillColor(
      245,
      249,
      255
    );

    doc.setDrawColor(
      190,
      213,
      241
    );

    doc.setLineWidth(0.5);

    doc.roundedRect(
      16,
      193,
      anchoPagina - 32,
      24,
      5,
      5,
      'FD'
    );

    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(8);

    doc.text(
      'ÚLTIMA UBICACIÓN',
      22,
      201
    );

    doc.setTextColor(
      30,
      47,
      68
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(8.5);

    const lineas =
      doc.splitTextToSize(
        direccion,
        anchoPagina - 44
      );

    doc.text(
      lineas.slice(0, 2),
      22,
      208
    );
  }


  private dibujarDescripcion(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number
  ): void {
    const descripcion = [
      datos.caracteristicas,
      datos.notasAnimal
    ]
      .filter(
        (valor): valor is string =>
          typeof valor === 'string' &&
          valor.trim() !== ''
      )
      .join('. ');

    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(8.5);

    doc.text(
      'INFORMACIÓN DEL CASO',
      16,
      225
    );

    doc.setTextColor(
      35,
      49,
      68
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(8.5);

    const texto =
      descripcion ||
      'No se proporcionaron características adicionales.';

    const lineas =
      doc.splitTextToSize(
        texto,
        anchoPagina - 32
      );

    doc.text(
      lineas.slice(0, 3),
      16,
      232
    );
  }


  private dibujarContacto(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number
  ): void {
    const nombre =
      this.formatoTitulo(
        datos.nombreContacto ||
        'Contacto no especificado'
      );

    const telefono =
      datos.telefonoContacto?.trim() ||
      'Sin teléfono';

    doc.setFillColor(
      0,
      88,
      190
    );

    doc.roundedRect(
      16,
      244,
      anchoPagina - 32,
      23,
      6,
      6,
      'F'
    );

    doc.setTextColor(
      255,
      255,
      255
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(7.5);

    doc.text(
      'INFORMACIÓN DE CONTACTO',
      23,
      252
    );

    doc.setFontSize(10);

    doc.text(
      nombre,
      23,
      260
    );

    doc.setFontSize(12);

    doc.text(
      telefono,
      anchoPagina - 23,
      259.5,
      {
        align: 'right'
      }
    );
  }


  /*
   * Talones recortables conservados.
   */
  private dibujarTalones(
    doc: jsPDF,
    datos: CartelReporte,
    anchoPagina: number,
    altoPagina: number
  ): void {
    const yInicio = 274;

    doc.setDrawColor(
      90,
      110,
      135
    );

    doc.setLineWidth(0.4);

    doc.setLineDashPattern(
      [2, 2],
      0
    );

    doc.line(
      10,
      yInicio,
      anchoPagina - 10,
      yInicio
    );

    doc.setLineDashPattern(
      [],
      0
    );

        /*
     * Este comprobante es exclusivo del reportante.
     * Debe retirarse antes de publicar o compartir el cartel.
     */
    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(6.4);

    doc.text(
      'RETIRA ESTA SECCIÓN ANTES DE PUBLICAR EL CARTEL',
      anchoPagina / 2,
      yInicio + 4,
      {
        align: 'center'
      }
    );

    const margenComprobante = 10;
    const yComprobante = yInicio + 6;
    const anchoComprobante =
      anchoPagina - margenComprobante * 2;
    const altoComprobante =
      altoPagina - yComprobante - 5;

    /*
     * Fondo del comprobante privado.
     */
    doc.setFillColor(
      240,
      247,
      255
    );

    doc.setDrawColor(
      165,
      200,
      235
    );

    doc.setLineWidth(0.4);

    doc.roundedRect(
      margenComprobante,
      yComprobante,
      anchoComprobante,
      altoComprobante,
      2.5,
      2.5,
      'FD'
    );

    /*
     * División entre las indicaciones y el folio.
     */
    const anchoIndicaciones = 118;
    const xDivision =
      margenComprobante + anchoIndicaciones;

    doc.setDrawColor(
      190,
      205,
      220
    );

    doc.line(
      xDivision,
      yComprobante + 2.5,
      xDivision,
      yComprobante + altoComprobante - 2.5
    );

    /*
     * Indicaciones para el reportante.
     */
        /*
     * Contenido compacto del comprobante privado.
     */
    const xContenidoIzquierdo =
      margenComprobante + 5;

    const centroFolio =
      xDivision +
      (
        anchoPagina -
        margenComprobante -
        xDivision
      ) / 2;

    /*
     * Columna izquierda.
     */
    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(6);

    doc.text(
      'COMPROBANTE PRIVADO DEL REPORTANTE',
      xContenidoIzquierdo,
      yComprobante + 3.8
    );

    doc.setTextColor(
      40,
      55,
      75
    );

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(4.8);

    doc.setFontSize(4.8);

    doc.text(
      'Conserva este folio para consultar, editar y dar seguimiento a tu reporte.',
      xContenidoIzquierdo,
      yComprobante + 8
    );

    doc.setTextColor(
      185,
      40,
      40
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(4.6);

    doc.text(
      'NO COMPARTAS ESTE FOLIO CON OTRAS PERSONAS',
      xContenidoIzquierdo,
      yComprobante + altoComprobante - 2,
    );

    /*
     * Columna derecha.
     */
    doc.setTextColor(
      65,
      80,
      105
    );

    doc.setFont(
      'helvetica',
      'bold'
    );

    doc.setFontSize(5.5);

    doc.text(
      'FOLIO DE SEGUIMIENTO',
      centroFolio,
      yComprobante + 4,
      {
        align: 'center'
      }
    );

    doc.setTextColor(
      0,
      88,
      190
    );

    doc.setFontSize(8.5);

    doc.text(
      datos.folio,
      centroFolio,
      yComprobante + 9.5,
      {
        align: 'center'
      }
    );
  }


  private obtenerMensajeCondicion(
    condicion?: string | null
  ): MensajeCondicion {
    const valor =
      condicion
        ?.trim()
        .toLocaleLowerCase('es-MX') ||
      '';

    /*
     * Se priorizan los casos médicos aunque también
     * tengan otra condición como callejero.
     */
    if (
      valor.includes('herido') ||
      valor.includes('enfermo')
    ) {
      return {
        etiqueta: 'NECESITA ATENCIÓN',
        titulo: '¡AYUDÉMOSLO AHORA!'
      };
    }

    if (
      valor.includes('extraviado')
    ) {
      return {
        etiqueta: 'ANIMAL EXTRAVIADO',
        titulo:
          'AYÚDALO A REGRESAR A CASA'
      };
    }

    if (
      valor.includes('callejero')
    ) {
      return {
        etiqueta:
          'BUSCA UNA OPORTUNIDAD',
        titulo:
          'AYÚDANOS A DARLE UN HOGAR'
      };
    }

    if (
      valor.includes('abandonado') ||
      valor.includes('maltratado')
    ) {
      return {
        etiqueta:
          'NECESITA PROTECCIÓN',
        titulo:
          'NO LO DEJEMOS SOLO'
      };
    }

    return {
      etiqueta: 'ANIMAL REPORTADO',
      titulo:
        'NECESITA NUESTRA AYUDA'
    };
  }


  /*
   * Equivalente a TitleCase para el PDF.
   */
  private formatoTitulo(
    valor?: string | null
  ): string {
    if (
      !valor ||
      valor.trim() === ''
    ) {
      return 'No Especificado';
    }

    return valor
      .trim()
      .toLocaleLowerCase('es-MX')
      .replace(
        /(^|[\s,./-])([a-záéíóúñü])/g,
        (
          _coincidencia: string,
          separador: string,
          letra: string
        ) =>
          `${separador}${letra.toLocaleUpperCase('es-MX')}`
      );
  }


  private convertirImagenParaPdf(
    imagen: File | string,
    anchoObjetivo: number,
    altoObjetivo: number
  ): Promise<string> {
    return new Promise(
      async (
        resolve,
        reject
      ) => {
        try {
          const dataUrl =
            imagen instanceof File
              ? await this.archivoADataUrl(
                  imagen
                )
              : await this.urlADataUrl(
                  imagen
                );

          const elementoImagen =
            new Image();

          elementoImagen.onload = () => {
            const canvas =
              document.createElement(
                'canvas'
              );

            canvas.width =
              anchoObjetivo;

            canvas.height =
              altoObjetivo;

            const contexto =
              canvas.getContext('2d');

            if (!contexto) {
              reject(
                new Error(
                  'No se pudo crear el contexto de la imagen.'
                )
              );

              return;
            }

            /*
             * Recorte centrado tipo cover.
             */
            const escala =
              Math.max(
                anchoObjetivo /
                  elementoImagen.width,
                altoObjetivo /
                  elementoImagen.height
              );

            const anchoEscalado =
              elementoImagen.width *
              escala;

            const altoEscalado =
              elementoImagen.height *
              escala;

            const x =
              (
                anchoObjetivo -
                anchoEscalado
              ) / 2;

            const y =
              (
                altoObjetivo -
                altoEscalado
              ) / 2;

            contexto.fillStyle =
              '#ffffff';

            contexto.fillRect(
              0,
              0,
              anchoObjetivo,
              altoObjetivo
            );

            contexto.drawImage(
              elementoImagen,
              x,
              y,
              anchoEscalado,
              altoEscalado
            );

            resolve(
              canvas.toDataURL(
                'image/jpeg',
                0.88
              )
            );
          };

          elementoImagen.onerror = () => {
            reject(
              new Error(
                'La imagen no pudo cargarse.'
              )
            );
          };

          elementoImagen.src =
            dataUrl;
        } catch (error) {
          reject(error);
        }
      }
    );
  }


  private archivoADataUrl(
    archivo: File
  ): Promise<string> {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const lector =
          new FileReader();

        lector.onload = () => {
          if (
            typeof lector.result ===
            'string'
          ) {
            resolve(
              lector.result
            );
          } else {
            reject(
              new Error(
                'No se pudo leer el archivo de imagen.'
              )
            );
          }
        };

        lector.onerror = () => {
          reject(
            lector.error ||
            new Error(
              'No se pudo leer la imagen.'
            )
          );
        };

        lector.readAsDataURL(
          archivo
        );
      }
    );
  }


  private async urlADataUrl(
    url: string
  ): Promise<string> {
    if (
      url.startsWith('data:')
    ) {
      return url;
    }

    const respuesta =
      await fetch(url);

    if (!respuesta.ok) {
      throw new Error(
        `No se pudo descargar la imagen: ${respuesta.status}`
      );
    }

    const blob =
      await respuesta.blob();

    return this.blobADataUrl(
      blob
    );
  }


  private blobADataUrl(
    blob: Blob
  ): Promise<string> {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const lector =
          new FileReader();

        lector.onload = () => {
          if (
            typeof lector.result ===
            'string'
          ) {
            resolve(
              lector.result
            );
          } else {
            reject(
              new Error(
                'No se pudo convertir la imagen.'
              )
            );
          }
        };

        lector.onerror = () => {
          reject(
            lector.error ||
            new Error(
              'No se pudo convertir la imagen.'
            )
          );
        };

        lector.readAsDataURL(
          blob
        );
      }
    );
  }


  private limpiarNombreArchivo(
    valor: string
  ): string {
    return valor
      .trim()
      .replace(
        /[^A-Za-z0-9_-]/g,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      );
  }
}