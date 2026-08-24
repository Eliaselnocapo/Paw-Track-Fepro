import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';

import {
  ModeracionService,
  ColaModeracion,
  DenunciaCola,
  CentroPendiente,
} from './moderacion.service';

describe('ModeracionService', () => {
  let service: ModeracionService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/moderacion/`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ModeracionService],
    });

    service = TestBed.inject(ModeracionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reportarFraude hace POST a incidencias/<folio>/reportar-fraude/ con { motivo }', () => {
    service.reportarFraude('ANO-EMG-00001', 'no existe el animal').subscribe();

    const req = httpMock.expectOne(`${base}incidencias/ANO-EMG-00001/reportar-fraude/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'no existe el animal' });

    req.flush({ code: 'fraude_reportado', detail: 'ok', field_errors: {} });
  });

  it('reportarFraude manda motivo vacío por defecto cuando no se indica', () => {
    service.reportarFraude('ANO-EMG-00001').subscribe();

    const req = httpMock.expectOne(`${base}incidencias/ANO-EMG-00001/reportar-fraude/`);
    expect(req.request.body).toEqual({ motivo: '' });
    req.flush({});
  });

  it('obtenerCola hace GET a cola/ y devuelve la forma exacta que espera la UI', () => {
    const denuncia: DenunciaCola = {
      id: 1,
      folio: 'ANO-EMG-00001',
      estado: 'PENDIENTE',
      tipo_animal: 'perro',
      usuario_reporta_email: 'reportante@example.com',
      reportes_fraude_count: 3,
      oculto_por_fraude: true,
      created_at: '2026-08-01T00:00:00Z',
      reportes: [
        {
          id: 10,
          usuario_reporta: 5,
          usuario_reporta_email: 'd1@example.com',
          motivo: 'sospechoso',
          created_at: '2026-08-01T00:00:00Z',
        },
      ],
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
    const respuesta: ColaModeracion = { denuncias: [denuncia], centros_pendientes: [centro] };

    let recibido: ColaModeracion | undefined;
    service.obtenerCola().subscribe((data) => (recibido = data));

    const req = httpMock.expectOne(`${base}cola/`);
    expect(req.request.method).toBe('GET');
    req.flush(respuesta);

    // Confirma que el paquete de datos llega intacto: mismas claves, sin
    // pérdida ni transformación implícita entre el HTTP response y el
    // objeto que consume el componente.
    expect(recibido).toEqual(respuesta);
  });

  it('resolverDenuncia hace POST a denuncias/<folio>/resolver/ con { accion }', () => {
    service.resolverDenuncia('ANO-EMG-00001', 'confirmar_fraude').subscribe();

    const req = httpMock.expectOne(`${base}denuncias/ANO-EMG-00001/resolver/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ accion: 'confirmar_fraude' });
    req.flush({});
  });

  it('resolverCentro hace POST a centros/<id>/resolver/ con { accion, motivo_rechazo }', () => {
    service.resolverCentro(2, 'rechazar', 'Datos incompletos').subscribe();

    const req = httpMock.expectOne(`${base}centros/2/resolver/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ accion: 'rechazar', motivo_rechazo: 'Datos incompletos' });
    req.flush({});
  });

  it('resolverCentro manda motivo_rechazo vacío por defecto', () => {
    service.resolverCentro(2, 'aprobar').subscribe();

    const req = httpMock.expectOne(`${base}centros/2/resolver/`);
    expect(req.request.body).toEqual({ accion: 'aprobar', motivo_rechazo: '' });
    req.flush({});
  });
});
