import { Component, OnInit } from '@angular/core';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonImg,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  imports: [
    IonAvatar,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonImg,
    IonLabel,
    IonList,
    IonModal,
    IonTitle,
    IonToolbar,
  ],
})
export class ModalComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
