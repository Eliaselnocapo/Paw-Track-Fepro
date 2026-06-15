import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sentenceCase',
  standalone: true
})
export class SentenceCasePipe implements PipeTransform {

  transform(value: string | null | undefined): string {
    if (!value) return '';

    const texto = value.trim().toLocaleLowerCase('es-MX');

    return texto.charAt(0).toLocaleUpperCase('es-MX') + texto.slice(1);
  }

}
