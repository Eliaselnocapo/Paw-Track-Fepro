import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalReportCacheService {
  private readonly key = 'pawtrack_guest_report_folios';

  guardarFolio(folio: string | null | undefined): void {
    if (!folio) return;

    const folios = this.obtenerFolios();

    if (!folios.includes(folio)) {
      folios.unshift(folio);
      localStorage.setItem(this.key, JSON.stringify(folios));
    }
  }

  obtenerFolios(): string[] {
    const raw = localStorage.getItem(this.key);

    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  limpiar(): void {
    localStorage.removeItem(this.key);
  }
}