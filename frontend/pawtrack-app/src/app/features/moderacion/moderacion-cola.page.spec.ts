import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ModeracionColaPage } from './moderacion-cola.page';
import { ModeracionService, ColaModeracion, DenunciaCola, CentroPendiente } from 'src/app/core/services/moderacion.service';

describe('ModeracionColaPage', () => {
  let component: ModeracionColaPage;
  let fixture: ComponentFixture<ModeracionColaPage>;
  let moderacionSpy: jasmine.SpyObj<ModeracionService>;

  const denuncia: DenunciaCola = {
    id: 1,
    folio: 'ANO-EMG-00001',
    estado: 'PENDIENTE',
    tipo_animal: 'perro',
    usuario_reporta_email: 'reportante@example.com',
    reportes_fraude_count: 3,
    oculto_por_fraude: true,
    created_at: '2026-08-01T00:00:00Z',
    reportes: [],
  };

  const centro: CentroPendiente = {
    id: 2,
    nombre: 'Refugio Test',
    tipo: 'refugio',
    correo: 'centro@example.com',
    telefono: '5555555555',
    direccion: 'CDMX',
    usuario_email: 'centro@example.com',
    estado: 'PENDIENTE',
    created_at: '2026-08-01T00:00:00Z',
  };

  const colaRespuesta: ColaModeracion = { denuncias: [denuncia], centros_pendientes: [centro] };

  beforeEach(() => {
    moderacionSpy = jasmine.createSpyObj('ModeracionService', [
      'obtenerCola',
      'resolverDenuncia',
      'resolverCentro',
    ]);
    moderacionSpy.obtenerCola.and.returnValue(of(colaRespuesta));

    TestBed.configureTestingModule({
      imports: [ModeracionColaPage, HttpClientTestingModule],
      providers: [{ provide: ModeracionService, useValue: moderacionSpy }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ModeracionColaPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit carga la cola y guarda denuncias/centros exactamente como llegan del backend', () => {
    fixture.detectChanges();

    expect(moderacionSpy.obtenerCola).toHaveBeenCalled();
    expect(component.cargando).toBeFalse();
    expect(component.denuncias).toEqual([denuncia]);
    expect(component.centrosPendientes).toEqual([centro]);
    expect(component.error).toBe('');
  });

  it('si obtenerCola falla, muestra el detail del backend y deja de cargar', () => {
    moderacionSpy.obtenerCola.and.returnValue(
      throwError(() => ({ error: { detail: 'Sin permisos' } }))
    );

    fixture.detectChanges();

    expect(component.cargando).toBeFalse();
    expect(component.error).toBe('Sin permisos');
  });

  it('si obtenerCola falla sin body, usa el mensaje por defecto', () => {
    moderacionSpy.obtenerCola.and.returnValue(throwError(() => ({})));

    fixture.detectChanges();

    expect(component.error).toBe('No se pudo cargar la cola de moderación.');
  });

  it('resolverDenuncia quita la denuncia resuelta de la lista local', () => {
    fixture.detectChanges();
    moderacionSpy.resolverDenuncia.and.returnValue(of({}));

    component.resolverDenuncia('ANO-EMG-00001', 'descartar');

    expect(moderacionSpy.resolverDenuncia).toHaveBeenCalledWith('ANO-EMG-00001', 'descartar');
    expect(component.denuncias).toEqual([]);
    expect(component.procesandoDenuncia['ANO-EMG-00001']).toBeFalse();
  });

  it('si resolverDenuncia falla, conserva la denuncia y muestra el error', () => {
    fixture.detectChanges();
    moderacionSpy.resolverDenuncia.and.returnValue(
      throwError(() => ({ error: { detail: 'accion invalida' } }))
    );

    component.resolverDenuncia('ANO-EMG-00001', 'confirmar_fraude');

    expect(component.denuncias).toEqual([denuncia]);
    expect(component.error).toBe('accion invalida');
    expect(component.procesandoDenuncia['ANO-EMG-00001']).toBeFalse();
  });

  it('resolverCentro quita el centro resuelto de la lista local', () => {
    fixture.detectChanges();
    moderacionSpy.resolverCentro.and.returnValue(of({}));

    component.resolverCentro(2, 'aprobar');

    expect(moderacionSpy.resolverCentro).toHaveBeenCalledWith(2, 'aprobar', '');
    expect(component.centrosPendientes).toEqual([]);
  });
});
