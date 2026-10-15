import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpEvent, HttpEventType, provideHttpClient } from '@angular/common/http';
import { TrackService } from './track.service';
import { Track } from '../models/track.model';

describe('TrackService', () => {
  let service: TrackService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    });
    service = TestBed.inject(TrackService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload a file and report progress', () => {
    const mockFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
    const mockTitle = 'Test Track';
    const mockTrack: Track = { id: '1', title: 'Test Track', originalName: 'test.mp3', mimeType: 'audio/mp3', size: 0, createdAt: new Date().toISOString() };
    
    let responseEvent: HttpEvent<Track> | undefined;
    
    service.upload(mockFile, mockTitle).subscribe(event => {
      responseEvent = event;
    });

    const req = httpTesting.expectOne('/api/tracks');
    expect(req.request.method).toEqual('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('audio')).toEqual(mockFile);
    expect(req.request.body.get('title')).toEqual(mockTitle);
    expect(req.request.reportProgress).toBe(true);
    
    req.flush(mockTrack);
    
    expect(responseEvent?.type).toBe(HttpEventType.Response);
    if (responseEvent?.type === HttpEventType.Response) expect(responseEvent.body).toEqual(mockTrack);
  });
  it('should list tracks with pagination params', () => {
    const page = 2;
    const limit = 10;
    
    service.list(page, limit).subscribe();
    
    const req = httpTesting.expectOne('/api/tracks?page=2&limit=10');
    expect(req.request.method).toEqual('GET');
    expect(req.request.params.get('page')).toEqual('2');
    expect(req.request.params.get('limit')).toEqual('10');
    
    req.flush({ items: [], total: 0 });
  });
});
