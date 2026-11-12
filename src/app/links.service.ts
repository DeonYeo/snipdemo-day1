import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksService {
  private readonly http = inject(HttpClient);

  list(): Observable<Link[]> {
    return this.http.get<Link[]>('/api/links');
  }

  create(url: string): Observable<Link> {
    return this.http.post<Link>('/api/links', { url });
  }
}
