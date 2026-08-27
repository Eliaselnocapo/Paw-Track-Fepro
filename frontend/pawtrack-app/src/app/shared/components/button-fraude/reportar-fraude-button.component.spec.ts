import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ReportarFraudeButtonComponent } from './reportar-fraude-button.component';
import { ModeracionService } from 'src/app/core/services/moderacion.service';

describe('ReportarFraudeButtonComponent', () => {
  let component: ReportarFraudeButtonComponent;
  let fixture: ComponentFixture<ReportarFraudeButtonComponent>;
  let moderacionSpy: jasmine.SpyObj<ModeracionService>;

  beforeEach(() => {
    moderacionSpy = jasmine.createSpyObj('ModeracionService', ['reportarFraude']);

    TestBed.configureTestingModule({
      imports: [ReportarFraudeButtonComponent],
      providers: [{ provide: ModeracionService, useValue: moderacionSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportarFraudeButtonComponent);
    component = fixture.componentInstance;
    component.folio = 'ANO-EMG-00001';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('abrirModal resetea error/exito/motivo', () => {
    component.error = 'algo';
    component.exito = true;
    component.motivo = 'texto viejo';

    component.abrirModal();

    expect(component.modalAbierto).toBeTrue();
    expect(component.error).toBe('');
    expect(component.exito).toBeFalse();
    expect(component.motivo).toBe('');
  });

  it('rechaza un motivo de solo espacios sin llamar al backend', () => {
    component.motivo = '   ';

    component.enviar();

    expect(component.error).toBe('El motivo no puede ser solo espacios en blanco.');
    expect(moderacionSpy.reportarFraude).not.toHaveBeenCalled();
  });

  it('rechaza un motivo demasiado corto sin llamar al backend', () => {
    component.motivo = 'ab';

    component.enviar();

    expect(component.error).toBe('Si vas a explicar el motivo, escribe al menos unas palabras.');
    expect(moderacionSpy.reportarFraude).not.toHaveBeenCalled();
  });

  it('permite motivo vacío (opcional) y llama al servicio con folio + motivo recortado', () => {
    moderacionSpy.reportarFraude.and.returnValue(of({}));
    component.motivo = '  ';
    component.motivo = ''; // vacío del todo es válido

    component.enviar();

    expect(moderacionSpy.reportarFraude).toHaveBeenCalledWith('ANO-EMG-00001', '');
    expect(component.exito).toBeTrue();
    expect(component.enviando).toBeFalse();
  });

  it('envía el motivo recortado (sin espacios extra) cuando es válido', () => {
    moderacionSpy.reportarFraude.and.returnValue(of({}));
    component.motivo = '  no existe el animal  ';

    component.enviar();

    expect(moderacionSpy.reportarFraude).toHaveBeenCalledWith('ANO-EMG-00001', 'no existe el animal');
  });

  it('traduce el code cannot_report_own_case del backend a un mensaje legible', () => {
    moderacionSpy.reportarFraude.and.returnValue(
      throwError(() => ({ error: { code: 'cannot_report_own_case' } }))
    );
    component.motivo = 'motivo valido';

    component.enviar();

    expect(component.error).toBe('No puedes reportar tu propio caso.');
    expect(component.enviando).toBeFalse();
  });

  it('traduce el code fraude_ya_reportado del backend a un mensaje legible', () => {
    moderacionSpy.reportarFraude.and.returnValue(
      throwError(() => ({ error: { code: 'fraude_ya_reportado' } }))
    );
    component.motivo = 'motivo valido';

    component.enviar();

    expect(component.error).toBe('Ya habías reportado este caso antes.');
  });

  it('usa el detail del backend si el code no es uno conocido', () => {
    moderacionSpy.reportarFraude.and.returnValue(
      throwError(() => ({ error: { detail: 'Error raro del servidor' } }))
    );
    component.motivo = 'motivo valido';

    component.enviar();

    expect(component.error).toBe('Error raro del servidor');
  });

  it('usa un mensaje genérico si la respuesta de error no trae detail ni code', () => {
    moderacionSpy.reportarFraude.and.returnValue(throwError(() => ({})));
    component.motivo = 'motivo valido';

    component.enviar();

    expect(component.error).toBe('No se pudo enviar el reporte. Intenta de nuevo.');
  });
});
