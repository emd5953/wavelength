export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface SpotifyImage {
  url: string;
}

export interface SpotifyArtist {
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album?: {
    images?: SpotifyImage[];
  };
}

export interface SpotifyUserResponse {
  id: string;
  display_name?: string;
  images?: SpotifyImage[];
  external_urls?: {
    spotify?: string;
  };
}

export interface SpotifyCurrentlyPlayingResponse {
  is_playing: boolean;
  progress_ms?: number;
  item?: SpotifyTrack | null;
}

export interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[];
}

export interface SpotifyTopTracksResponse {
  items: SpotifyTrack[];
}
