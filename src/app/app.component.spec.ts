import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Link } from './links.service';

describe('AppComponent', () => {
  let http: HttpTestingController;
  const link: Link = {
    code: 'abc123', url: 'https://example.com/', shortUrl: 'http://localhost:3000/abc123',
    hits: 0, createdAt: '2026-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('rejects invalid schemes and blank input without posting', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne('/api/links').flush([]);
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.url.invalid).toBeTrue();
    fixture.componentInstance.url.setValue('javascript:alert(1)');
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.url.invalid).toBeTrue();
    fixture.componentInstance.url.setValue('   ');
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.url.invalid).toBeTrue();
    http.expectNone(request => request.method === 'POST');
  });

  it('submits once while pending and refreshes the list on success', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne('/api/links').flush([]);
    const app = fixture.componentInstance;
    app.url.setValue('https://example.com');
    app.submit();
    app.submit();
    const post = http.expectOne(request => request.method === 'POST' && request.url === '/api/links');
    expect(post.request.body).toEqual({ url: 'https://example.com' });
    post.flush(link, { status: 201, statusText: 'Created' });
    http.expectOne('/api/links').flush([link]);
    fixture.detectChanges();
    expect(app.result()).toEqual(link);
    expect(app.links()).toEqual([link]);
    expect(app.submitting()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('abc123');
  });

  it('shows server and list errors and allows retry', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne('/api/links').flush('failed', { status: 500, statusText: 'Error' });
    expect(fixture.componentInstance.listError()).toBeTruthy();
    fixture.componentInstance.url.setValue('https://example.com');
    fixture.componentInstance.submit();
    http.expectOne(request => request.method === 'POST').flush(
      { error: 'Invalid URL' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.submitError()).toBe('Invalid URL');
    expect(fixture.componentInstance.submitting()).toBeFalse();
    fixture.componentInstance.refresh();
    http.expectOne('/api/links').flush([]);
    expect(fixture.componentInstance.listError()).toBe('');
    fixture.componentInstance.submit();
    http.expectOne(request => request.method === 'POST').error(new ProgressEvent('error'));
    expect(fixture.componentInstance.submitError()).toContain('Could not shorten');
    expect(fixture.componentInstance.submitting()).toBeFalse();
  });

  it('cancels a stale list request before refreshing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const stale = http.expectOne('/api/links');
    fixture.componentInstance.refresh();
    expect(stale.cancelled).toBeTrue();
    http.expectOne('/api/links').flush([link]);
    expect(fixture.componentInstance.links()).toEqual([link]);
  });
});
