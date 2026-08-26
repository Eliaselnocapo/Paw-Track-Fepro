import { Directive, ElementRef, Input, OnInit, AfterViewInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input() revealDelay: number = 0;
  @Input() revealVariant: 'default' | 'fade' = 'default';

  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const element = this.el.nativeElement;
    element.classList.add(this.revealVariant === 'fade' ? 'reveal-fade' : 'reveal');

    if (this.revealDelay) {
      element.style.transitionDelay = `${this.revealDelay}ms`;
    }
  }

  ngAfterViewInit(): void {
    this.observarElemento();
  }

  /**
   * Reinicia la animación desde cero y vuelve a observar. Pensado para
   * llamarse desde ionViewWillEnter() de la página, ya que Ionic cachea
   * componentes y ngOnInit/ngAfterViewInit no vuelven a correr al
   * navegar de regreso a una página ya visitada.
   */
  replay(): void {
    const element = this.el.nativeElement;

    this.observer?.disconnect();
    element.classList.remove('is-visible');

    void element.offsetHeight; // reflow forzado

    this.observarElemento();
  }

  private observarElemento(): void {
    const element = this.el.nativeElement;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            element.classList.add('is-visible');
            this.observer?.unobserve(element);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px 100px 0px' }
    );

    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}