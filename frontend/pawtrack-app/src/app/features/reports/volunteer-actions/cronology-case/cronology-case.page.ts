import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-cronology-case',
  templateUrl: './cronology-case.page.html',
  styleUrls: ['./cronology-case.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class CronologyCasePage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
