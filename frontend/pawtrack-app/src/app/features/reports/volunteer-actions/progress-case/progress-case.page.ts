import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-progress-case',
  templateUrl: './progress-case.page.html',
  styleUrls: ['./progress-case.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ProgressCasePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
