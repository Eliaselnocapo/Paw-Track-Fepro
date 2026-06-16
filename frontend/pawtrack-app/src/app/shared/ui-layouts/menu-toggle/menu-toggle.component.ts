import { Component, OnInit } from '@angular/core';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonMenu,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-menu-toggle',
  templateUrl: './menu-toggle.component.html',
  styleUrls: ['./menu-toggle.component.scss'],
  imports: [IonMenu, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent]
})
export class MenuToggleComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
