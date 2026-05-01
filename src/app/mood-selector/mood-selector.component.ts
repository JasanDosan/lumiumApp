import { Component } from '@angular/core';
import { MovieService } from '../movie.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mood-selector',
  template: `
    <select (change)="onMoodChange($event.target.value)">
      <option value="">Selecciona tu estado de ánimo</option>
      <option value="feliz">Feliz</option>
      <option value="triste">Triste</option>
      <option value="emocionado">Emocionado</option>
      <option value="relajado">Relajado</option>
    </select>
  `
})
export class MoodSelectorComponent {
  constructor(private movieService: MovieService, private router: Router) {}

  onMoodChange(mood: string) {
    this.movieService.getMoviesByMood(mood).subscribe(movies => {
      // Navega a la lista de películas con los datos
      this.router.navigate(['/movies'], { state: { movies } });
    });
  }
}
