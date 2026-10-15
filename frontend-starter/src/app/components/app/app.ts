import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // Après un rechargement, seul le token survit (localStorage) : on recharge
    // le profil pour remplir à nouveau le Signal currentUser. Un token expiré
    // déclenche un 401 traité par l'intercepteur (retour vers /login).
    if (this.auth.token()) {
      this.auth.profile().subscribe({
        error: (error) => console.error('[App] Restauration du profil impossible', error.status),
      });
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
