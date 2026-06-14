import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { ViewWebComponent } from './views/view-web/view-web.component';

@Component({
  selector: 'app-reporter',
  standalone: true,
  imports: [IonContent, ViewWebComponent],
  templateUrl: './reporter.page.html',
  styleUrls: ['./reporter.page.scss'],
})
export class ReporterPage {}