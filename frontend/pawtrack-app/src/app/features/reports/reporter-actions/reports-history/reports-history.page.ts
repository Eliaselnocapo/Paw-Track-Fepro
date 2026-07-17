import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-reports-history',
  templateUrl: './reports-history.page.html',
  styleUrls: ['./reports-history.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ReportsHistory implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
