export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  actors: string[];
  posterUrl?: string;
  overview: string;
}
