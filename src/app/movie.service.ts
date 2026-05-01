import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MovieService {
  private apiKey = '9eab347ff7e846c61f8d0cbf4b73ae6c'; // Reemplaza con tu API Key
  private apiUrl = 'https://api.themoviedb.org/3';

  constructor(private http: HttpClient) {}

  getMoviesByMood(mood: string): Observable<any> {
    // Aquí puedes mapear estados de ánimo a géneros o palabras clave
    let genreId: number;
    switch (mood.toLowerCase()) {
      case 'feliz':
        genreId = 35; // Comedia
        break;
      case 'triste':
        genreId = 18; // Drama
        break;
      case 'emocionado':
        genreId = 28; // Acción
        break;
      case 'relajado':
        genreId = 99; // Documental o 10402 (Música)
        break;
      default:
        genreId = 18; // Valor por defecto (Drama)
    }

    return this.http.get(`${this.apiUrl}/discover/movie`, {
      params: {
        api_key: this.apiKey,
        with_genres: genreId.toString(),
        language: 'es-ES' // Para resultados en español
      }
    });
  }

  getMovieDetails(movieId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/movie/${movieId}`, {
      params: {
        api_key: this.apiKey,
        language: 'es-ES'
      }
    });
  }
}
