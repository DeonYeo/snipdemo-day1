import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { Link, LinksService } from './links.service';

function httpUrl(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return { httpUrl: true };
  try {
    const url = new URL(value);
    return value.length <= 2048 && (url.protocol === 'http:' || url.protocol === 'https:')
      ? null : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
}

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly linksService = inject(LinksService);
  private listRequest?: Subscription;
  readonly url = new FormControl('', { nonNullable: true, validators: [Validators.required, httpUrl] });
  readonly links = signal<Link[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly listError = signal('');
  readonly submitError = signal('');
  readonly result = signal<Link | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.listError.set('');
    this.listRequest = this.linksService.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: links => this.links.set(links),
      error: () => this.listError.set('Could not load links. Please try again.')
    });
  }

  submit(): void {
    if (this.submitting()) return;
    this.submitError.set('');
    this.result.set(null);
    this.url.markAsTouched();
    if (this.url.invalid) return;

    this.submitting.set(true);
    this.linksService.create(this.url.value.trim())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: link => {
          this.result.set(link);
          this.url.reset();
          this.refresh();
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.error;
          this.submitError.set(typeof message === 'string' && message.trim()
            ? message : 'Could not shorten the URL. Please try again.');
        }
      });
  }
}
