import { Component, OnInit } from '@angular/core';
import { IonMenuButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-menu-toggle',
  templateUrl: './menu-toggle.component.html',
  styleUrls: ['./menu-toggle.component.scss'],
  imports: [IonMenuButton]
})
export class MenuToggleComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
