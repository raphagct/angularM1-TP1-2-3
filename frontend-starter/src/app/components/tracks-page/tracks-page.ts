import { Component, inject, signal, DestroyRef, ElementRef, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

// Mêmes contrôles que le backend (multer : fileFilter et limits.fileSize).
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Libellés français du paginator Angular Material. */
function frenchPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Pistes par page :';
  intl.nextPageLabel = 'Page suivante';
  intl.previousPageLabel = 'Page précédente';
  intl.firstPageLabel = 'Première page';
  intl.lastPageLabel = 'Dernière page';
  intl.getRangeLabel = (page, pageSize, length) => {
    if (length === 0) return '0 sur 0';
    const start = page * pageSize;
    return `${start + 1} – ${Math.min(start + pageSize, length)} sur ${length}`;
  };
  return intl;
}

@Component({
  imports: [ReactiveFormsModule, MatPaginatorModule, MatSnackBarModule, DatePipe, DecimalPipe],
  providers: [{ provide: MatPaginatorIntl, useFactory: frenchPaginatorIntl }],
  templateUrl: './tracks-page.html', 
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly audioUrl = signal('');
  readonly title = new FormControl('', { nonNullable: true });
  
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly ghostFile = signal<File | null>(null);
  
  readonly currentTrack = signal<Track | null>(null);
  readonly playError = signal<string | null>(null);
  readonly deleting = signal<Set<string>>(new Set());
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  file?: File;

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => {
      if (this.audioUrl()) URL.revokeObjectURL(this.audioUrl());
    });
  }

  choose(event: Event): void {
    if (this.uploading()) return;
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);
    this.file = (event.target as HTMLInputElement).files?.[0];
    
    if (!this.file) return;

    if (!ALLOWED_TYPES.includes(this.file.type)) {
      this.uploadError.set('Format non accepté : choisissez un fichier MP3, WAV, OGG ou M4A.');
      this.file = undefined;
      return;
    }

    if (this.file.size > MAX_FILE_SIZE) {
      this.uploadError.set('Le fichier ne doit pas dépasser 25 Mo.');
      this.file = undefined;
      return;
    }

    console.debug('[TracksPage] Fichier valide', this.file.name);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        // Après une suppression, la page courante peut ne plus exister.
        if (this.page() > response.pages) {
          this.page.set(response.pages);
          this.load();
          return;
        }
        this.tracks.set(response.items);
        this.total.set(response.total);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: () => {
        console.error('[TracksPage] Chargement impossible');
        this.error.set('Impossible de charger les pistes.');
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.limit.set(event.pageSize);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    this.uploading.set(true);
    this.title.disable();
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    this.uploadProgress.set(0);
    this.ghostFile.set(this.file);

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total) {
            this.uploadProgress.set(Math.round(100 * event.loaded / event.total));
          }
        } else if (event.type === HttpEventType.Response) {
          console.debug('[TracksPage] Piste envoyée', event.body?.id);
          this.uploadSuccess.set('Piste envoyée avec succès !');
          this.title.setValue('');
          this.file = undefined;
          const input = this.fileInput()?.nativeElement;
          if (input) input.value = '';
          this.ghostFile.set(null);
          this.uploading.set(false);
          this.title.enable();
          this.page.set(1);
          this.load();
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Envoi impossible', error.status);
        // Le backend renvoie { message } (ex. 400 « Format audio non accepté »).
        this.uploadError.set(error.error?.message ?? 'Erreur serveur lors de l\'envoi.');
        this.uploading.set(false);
        this.title.enable();
        this.ghostFile.set(null);
      },
    });
  }

  play(track: Track): void {
    this.currentTrack.set(track);
    this.playError.set(null);

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Lecture impossible', error.status);
        this.playError.set(
          error.status === 404
            ? 'Cette piste n’existe plus ou ne vous appartient pas.'
            : 'Impossible de télécharger la piste.',
        );
      }
    });
  }

  /** Arrête le lecteur et libère la mémoire du Blob (ex. piste supprimée). */
  private stopPlayback(): void {
    if (this.audioUrl()) URL.revokeObjectURL(this.audioUrl());
    this.audioUrl.set('');
    this.currentTrack.set(null);
  }

  /** Erreur levée par l'élément <audio> lui-même (fichier illisible ou corrompu). */
  onAudioError(): void {
    this.playError.set('Le navigateur ne parvient pas à lire ce fichier audio.');
  }

  delete(track: Track): void {
    if (this.deleting().has(track.id)) return;
    if (!confirm(`Voulez-vous vraiment supprimer la piste "${track.title}" ?`)) {
      return;
    }
    
    const currentDeleting = new Set(this.deleting());
    currentDeleting.add(track.id);
    this.deleting.set(currentDeleting);

    this.service.delete(track.id).subscribe({
      next: () => {
        console.debug('[TracksPage] Piste supprimée', track.id);
        this.snackBar.open('Piste supprimée avec succès', 'Fermer', { duration: 3000 });
        if (this.currentTrack()?.id === track.id) this.stopPlayback();
        const updatedDeleting = new Set(this.deleting());
        updatedDeleting.delete(track.id);
        this.deleting.set(updatedDeleting);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        console.error('[TracksPage] Suppression impossible', err.status);
        let errorMessage = 'Impossible de supprimer la piste.';
        if (err.status === 404) {
          errorMessage = 'La piste n’existe plus ou ne vous appartient pas.';
        } else if (err.status === 403 || err.status === 401) {
          errorMessage = 'Vous n\'êtes pas autorisé à supprimer cette piste.';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });
        
        const updatedDeleting = new Set(this.deleting());
        updatedDeleting.delete(track.id);
        this.deleting.set(updatedDeleting);
        this.load(); // Le backend renvoie aussi 404 si le propriétaire ne correspond pas.
      }
    });
  }
}
