import { Preferences } from "@capacitor/preferences";
import type { Movie } from "./catalog";

const API_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const CACHE_KEY = "cinematch:tmdb-movies:v1";
const MOVIE_LIMIT = 12;

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  genre_ids: number[];
  poster_path: string | null;
  overview: string;
};

type TmdbGenresResponse = {
  genres: Array<{ id: number; name: string }>;
};

type TmdbPopularResponse = {
  results: TmdbMovie[];
};

type TmdbCreditsResponse = {
  cast: Array<{ name: string }>;
};

export type MovieCatalogResult = {
  movies: Movie[];
  notice: string;
};

async function request<T>(path: string, apiKey: string): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "fr-FR");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB a répondu avec le statut ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

async function loadCachedMovies(): Promise<Movie[] | null> {
  const { value } = await Preferences.get({ key: CACHE_KEY });
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Le catalogue TMDB enregistré localement est illisible.");
  }
  return parsed as Movie[];
}

export async function loadMovieCatalog(): Promise<MovieCatalogResult> {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim();
  let cachedMovies: Movie[] | null = null;
  let cacheNotice = "";

  try {
    cachedMovies = await loadCachedMovies();
  } catch (error) {
    cacheNotice = error instanceof Error ? ` Cache local ignoré : ${error.message}` : "";
  }

  if (!apiKey) {
    return {
      movies: cachedMovies ?? [],
      notice: `Clé TMDB absente : configurez VITE_TMDB_API_KEY dans .env.local.${cacheNotice}`,
    };
  }

  try {
    const [popular, genreResponse] = await Promise.all([
      request<TmdbPopularResponse>("/movie/popular", apiKey),
      request<TmdbGenresResponse>("/genre/movie/list", apiKey),
    ]);
    const genreNames = new Map(genreResponse.genres.map((genre) => [genre.id, genre.name]));
    const movies = await Promise.all(popular.results.slice(0, MOVIE_LIMIT).map(async (item) => {
      const credits = await request<TmdbCreditsResponse>(`/movie/${item.id}/credits`, apiKey);
      const year = Number(item.release_date?.slice(0, 4));
      return {
        id: `tmdb-${item.id}`,
        title: item.title,
        year: Number.isInteger(year) && year > 0 ? year : 0,
        genres: item.genre_ids.map((id) => genreNames.get(id)).filter(
          (name): name is string => Boolean(name),
        ),
        actors: credits.cast.slice(0, 5).map((actor) => actor.name),
        posterUrl: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : undefined,
        overview: item.overview,
      } satisfies Movie;
    }));

    try {
      await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(movies) });
      return { movies, notice: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erreur inconnue";
      return { movies, notice: `Films chargés depuis TMDB, mais cache local impossible : ${message}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return {
      movies: cachedMovies ?? [],
      notice: `TMDB est indisponible (${message}) ; ${cachedMovies?.length ? "catalogue TMDB local en cache utilisé." : "aucun film ne peut être chargé."}${cacheNotice}`,
    };
  }
}
