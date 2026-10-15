import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TracksPageComponent } from './tracks-page';

// Le véritable service est conservé ; seul le transport HTTP est simulé.
describe('TracksPageComponent', () => {
  let component: TracksPageComponent;
  let http: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const track = { id: '1', title: 'Test', originalName: 'test.mp3', mimeType: 'audio/mpeg', size: 100, createdAt: '2026-01-01' };
  const page = { items: [track], total: 1, page: 1, limit: 5, pages: 1 };

  beforeEach(() => {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      imports: [TracksPageComponent],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting(), { provide: MatSnackBar, useValue: snackBar }],
    });
    TestBed.overrideProvider(MatSnackBar, { useValue: snackBar });
    component = TestBed.createComponent(TracksPageComponent).componentInstance;
    http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/tracks?page=1&limit=5').flush(page);
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('supprime après confirmation, bloque un double appel et recharge la liste', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete(track);
    component.delete(track);
    const req = http.expectOne('/api/tracks/1');
    expect(req.request.method).toBe('DELETE');
    expect(component.deleting().has('1')).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/tracks?page=1&limit=5').flush({ ...page, items: [], total: 0 });
    expect(component.tracks()).toEqual([]);
    expect(component.deleting().size).toBe(0);
    expect(snackBar.open).toHaveBeenCalledWith('Piste supprimée avec succès', 'Fermer', { duration: 3000 });
  });

  it('revient à la dernière page disponible lorsque la page courante devient vide', () => {
    component.page.set(2);
    component.load();
    http.expectOne('/api/tracks?page=2&limit=5').flush({ ...page, items: [], total: 5 });
    expect(component.page()).toBe(1);
    http.expectOne('/api/tracks?page=1&limit=5').flush({ ...page, total: 5 });
    expect(component.tracks()).toEqual([track]);
  });

  it('ne supprime pas si la confirmation est annulée', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.delete(track);
    http.expectNone('/api/tracks/1');
    expect(component.deleting().size).toBe(0);
  });

  it.each([404, 403, 401])('affiche un SnackBar et libère la suppression après une erreur %s', status => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete(track);
    http.expectOne('/api/tracks/1').flush({}, { status, statusText: 'Erreur' });
    http.expectOne('/api/tracks?page=1&limit=5').flush(page);
    expect(component.deleting().size).toBe(0);
    expect(snackBar.open).toHaveBeenCalledWith(status === 404 ? 'La piste n’existe plus ou ne vous appartient pas.' : 'Vous n\'êtes pas autorisé à supprimer cette piste.', 'Fermer', { duration: 3000 });
  });

  it('affiche la progression intermédiaire et attend la réponse pour annoncer la réussite', () => {
    component.file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });
    component.title.setValue('Mon titre');
    component.upload();
    component.upload();
    const req = http.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    expect(req.request.body.get('title')).toBe('Mon titre');
    expect(req.request.body.get('audio').name).toBe('test.mp3');
    expect(component.title.disabled).toBe(true);
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    expect(component.uploadProgress()).toBe(50);
    expect(component.uploading()).toBe(true);
    expect(component.uploadSuccess()).toBeNull();
    req.flush(track, { status: 201, statusText: 'Created' });
    http.expectOne('/api/tracks?page=1&limit=5').flush(page);
    expect(component.uploading()).toBe(false);
    expect(component.title.enabled).toBe(true);
    expect(component.uploadSuccess()).toBe('Piste envoyée avec succès !');
    expect(component.file).toBeUndefined();
    expect(component.ghostFile()).toBeNull();
  });

  it('gère un échec d’upload et permet une nouvelle tentative', () => {
    component.file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });
    component.upload();
    http.expectOne('/api/tracks').flush({}, { status: 500, statusText: 'Server Error' });
    expect(component.uploadError()).toBe("Erreur serveur lors de l'envoi.");
    expect(component.uploading()).toBe(false);
    expect(component.title.enabled).toBe(true);
    expect(component.file).toBeDefined();
    expect(component.ghostFile()).toBeNull();
  });

  it('affiche une erreur de chargement dans le template', () => {
    const fixture = TestBed.createComponent(TracksPageComponent);
    http.expectOne('/api/tracks?page=1&limit=5').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Impossible de charger les pistes.');
  });
  it('refuse avant tout appel HTTP un type MIME que le backend n’accepte pas', () => {
    const select = (file: File) => component.choose({ target: { files: [file] } } as unknown as Event);
    select(new File(['x'], 'son.flac', { type: 'audio/flac' }));
    expect(component.file).toBeUndefined();
    expect(component.uploadError()).toContain('Format non accepté');
    select(new File(['x'], 'son.mp3', { type: 'audio/mpeg' }));
    expect(component.file?.name).toBe('son.mp3');
    expect(component.uploadError()).toBeNull();
  });

  it('affiche le message renvoyé par le serveur après un refus 400', () => {
    component.file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });
    component.upload();
    http.expectOne('/api/tracks').flush({ message: 'Format audio non accepté' }, { status: 400, statusText: 'Bad Request' });
    expect(component.uploadError()).toBe('Format audio non accepté');
  });

  it('demande l’audio en Blob et affiche une erreur compréhensible si la piste est introuvable', () => {
    component.play(track);
    const req = http.expectOne('/api/tracks/1/audio');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(), { status: 404, statusText: 'Not Found' });
    expect(component.currentTrack()).toEqual(track);
    expect(component.playError()).toBe('Cette piste n’existe plus ou ne vous appartient pas.');
    expect(component.audioUrl()).toBe('');
  });
  it('arrête la lecture et révoque l’ObjectURL quand la piste lue est supprimée', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    component.audioUrl.set('blob:piste-1');
    component.currentTrack.set(track);
    component.delete(track);
    http.expectOne('/api/tracks/1').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/tracks?page=1&limit=5').flush({ ...page, items: [], total: 0 });
    expect(revoke).toHaveBeenCalledWith('blob:piste-1');
    expect(component.audioUrl()).toBe('');
    expect(component.currentTrack()).toBeNull();
  });
});
