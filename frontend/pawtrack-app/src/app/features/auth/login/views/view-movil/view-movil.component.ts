import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-view-movil',
  templateUrl: './view-movil.component.html',
  styleUrls: ['./view-movil.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ]
})
export class ViewMovilComponent implements OnInit {

  constructor() {}

  ngOnInit() {}

}
