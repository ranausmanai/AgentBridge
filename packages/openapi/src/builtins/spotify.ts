import type { AgentBridgeManifest } from '../types.js';

export const SPOTIFY_CLIENT_ID = 'd2e90bdd6b3c4373a5f7b49658a558ab';
export const SPOTIFY_CLI_CALLBACK_PORT = 8574;

export const spotifyManifest: AgentBridgeManifest = {
  schema_version: '1.0',
  name: 'spotify',
  description: 'Spotify Web API — search music, control playback, manage playlists and library',
  version: '1.0.0',
  logo_url: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
  base_url: 'https://api.spotify.com/v1',
  auth: {
    type: 'oauth2',
    oauth2: {
      authorization_url: 'https://accounts.spotify.com/authorize',
      token_url: 'https://accounts.spotify.com/api/token',
      scopes: {
        'user-read-private': 'Read your account details',
        'user-read-email': 'Read your email address',
        'user-read-playback-state': 'Read your playback state',
        'user-modify-playback-state': 'Control playback',
        'user-read-currently-playing': 'Read currently playing track',
        'user-top-read': 'Read your top artists and tracks',
        'user-library-read': 'Read your saved library',
        'user-library-modify': 'Modify your saved library',
        'playlist-read-private': 'Read your private playlists',
        'playlist-modify-public': 'Modify your public playlists',
        'playlist-modify-private': 'Modify your private playlists',
        'user-read-recently-played': 'Read your recently played tracks',
      },
    },
    instructions: 'Create an app at https://developer.spotify.com/dashboard to get your client ID.',
  },
  actions: [
    {
      id: 'get_current_user',
      description: 'Get the current user\'s Spotify profile',
      method: 'GET',
      path: '/me',
      parameters: [],
    },
    {
      id: 'search',
      description: 'Search for tracks, artists, albums, or playlists on Spotify',
      method: 'GET',
      path: '/search',
      parameters: [
        { name: 'q', description: 'Search query', in: 'query', required: true, type: 'string' },
        { name: 'type', description: 'Comma-separated list: track, artist, album, playlist', in: 'query', required: true, type: 'string', default: 'track' },
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
        { name: 'offset', description: 'Result offset for pagination', in: 'query', required: false, type: 'integer', default: 0 },
      ],
    },
    {
      id: 'get_top_tracks',
      description: 'Get the current user\'s top tracks',
      method: 'GET',
      path: '/me/top/tracks',
      parameters: [
        { name: 'time_range', description: 'Over what time frame: short_term (4 weeks), medium_term (6 months), long_term (all time)', in: 'query', required: false, type: 'string', default: 'medium_term' },
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
      ],
    },
    {
      id: 'get_top_artists',
      description: 'Get the current user\'s top artists',
      method: 'GET',
      path: '/me/top/artists',
      parameters: [
        { name: 'time_range', description: 'Over what time frame: short_term, medium_term, long_term', in: 'query', required: false, type: 'string', default: 'medium_term' },
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
      ],
    },
    {
      id: 'get_my_playlists',
      description: 'Get a list of the current user\'s playlists',
      method: 'GET',
      path: '/me/playlists',
      parameters: [
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
        { name: 'offset', description: 'Result offset', in: 'query', required: false, type: 'integer', default: 0 },
      ],
    },
    {
      id: 'create_playlist',
      description: 'Create a playlist for a Spotify user',
      method: 'POST',
      path: '/users/{user_id}/playlists',
      confirm: true,
      parameters: [
        { name: 'user_id', description: 'The Spotify user ID', in: 'path', required: true, type: 'string' },
        { name: 'name', description: 'Playlist name', in: 'body', required: true, type: 'string' },
        { name: 'description', description: 'Playlist description', in: 'body', required: false, type: 'string' },
        { name: 'public', description: 'Whether the playlist is public', in: 'body', required: false, type: 'boolean' },
      ],
    },
    {
      id: 'get_playlist',
      description: 'Get a Spotify playlist by ID',
      method: 'GET',
      path: '/playlists/{playlist_id}',
      parameters: [
        { name: 'playlist_id', description: 'The Spotify playlist ID', in: 'path', required: true, type: 'string' },
      ],
    },
    {
      id: 'get_playlist_tracks',
      description: 'Get tracks in a Spotify playlist',
      method: 'GET',
      path: '/playlists/{playlist_id}/tracks',
      parameters: [
        { name: 'playlist_id', description: 'The Spotify playlist ID', in: 'path', required: true, type: 'string' },
        { name: 'limit', description: 'Max results (1-100)', in: 'query', required: false, type: 'integer', default: 100 },
        { name: 'offset', description: 'Result offset', in: 'query', required: false, type: 'integer', default: 0 },
      ],
    },
    {
      id: 'add_tracks_to_playlist',
      description: 'Add one or more tracks to a playlist',
      method: 'POST',
      path: '/playlists/{playlist_id}/tracks',
      confirm: true,
      parameters: [
        { name: 'playlist_id', description: 'The Spotify playlist ID', in: 'path', required: true, type: 'string' },
        { name: 'uris', description: 'Array of Spotify track URIs (e.g. spotify:track:4iV5W9uYEdYUVa79Axb7Rh)', in: 'body', required: true, type: 'array' },
        { name: 'position', description: 'Position to insert tracks (0-based)', in: 'body', required: false, type: 'integer' },
      ],
    },
    {
      id: 'remove_tracks_from_playlist',
      description: 'Remove one or more tracks from a playlist',
      method: 'DELETE',
      path: '/playlists/{playlist_id}/tracks',
      confirm: true,
      parameters: [
        { name: 'playlist_id', description: 'The Spotify playlist ID', in: 'path', required: true, type: 'string' },
        { name: 'tracks', description: 'Array of objects with uri field (e.g. [{uri: "spotify:track:..."}])', in: 'body', required: true, type: 'array' },
      ],
    },
    {
      id: 'get_playback_state',
      description: 'Get the current user\'s playback state (device, track, progress, etc.)',
      method: 'GET',
      path: '/me/player',
      parameters: [],
    },
    {
      id: 'start_playback',
      description: 'Start or resume playback on a device',
      method: 'PUT',
      path: '/me/player/play',
      confirm: true,
      parameters: [
        { name: 'device_id', description: 'Device ID to play on', in: 'query', required: false, type: 'string' },
        { name: 'context_uri', description: 'Spotify URI of context to play (album, artist, playlist)', in: 'body', required: false, type: 'string' },
        { name: 'uris', description: 'Array of Spotify track URIs to play', in: 'body', required: false, type: 'array' },
        { name: 'offset', description: 'Where in context to start (e.g. {position: 0})', in: 'body', required: false, type: 'object' },
      ],
    },
    {
      id: 'pause_playback',
      description: 'Pause playback on a device',
      method: 'PUT',
      path: '/me/player/pause',
      confirm: true,
      parameters: [
        { name: 'device_id', description: 'Device ID to pause on', in: 'query', required: false, type: 'string' },
      ],
    },
    {
      id: 'skip_next',
      description: 'Skip to the next track',
      method: 'POST',
      path: '/me/player/next',
      confirm: true,
      parameters: [
        { name: 'device_id', description: 'Device ID', in: 'query', required: false, type: 'string' },
      ],
    },
    {
      id: 'skip_previous',
      description: 'Skip to the previous track',
      method: 'POST',
      path: '/me/player/previous',
      confirm: true,
      parameters: [
        { name: 'device_id', description: 'Device ID', in: 'query', required: false, type: 'string' },
      ],
    },
    {
      id: 'get_currently_playing',
      description: 'Get the track currently playing on the user\'s Spotify',
      method: 'GET',
      path: '/me/player/currently-playing',
      parameters: [],
    },
    {
      id: 'get_recently_played',
      description: 'Get the current user\'s recently played tracks',
      method: 'GET',
      path: '/me/player/recently-played',
      parameters: [
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
      ],
    },
    {
      id: 'get_saved_tracks',
      description: 'Get the current user\'s saved (liked) tracks',
      method: 'GET',
      path: '/me/tracks',
      parameters: [
        { name: 'limit', description: 'Max results (1-50)', in: 'query', required: false, type: 'integer', default: 20 },
        { name: 'offset', description: 'Result offset', in: 'query', required: false, type: 'integer', default: 0 },
      ],
    },
    {
      id: 'save_tracks',
      description: 'Save (like) one or more tracks to the user\'s library',
      method: 'PUT',
      path: '/me/tracks',
      confirm: true,
      parameters: [
        { name: 'ids', description: 'Comma-separated list of Spotify track IDs', in: 'query', required: true, type: 'string' },
      ],
    },
    {
      id: 'remove_saved_tracks',
      description: 'Remove one or more tracks from the user\'s saved library',
      method: 'DELETE',
      path: '/me/tracks',
      confirm: true,
      parameters: [
        { name: 'ids', description: 'Comma-separated list of Spotify track IDs', in: 'query', required: true, type: 'string' },
      ],
    },
    {
      id: 'get_album',
      description: 'Get a Spotify album by ID',
      method: 'GET',
      path: '/albums/{id}',
      parameters: [
        { name: 'id', description: 'The Spotify album ID', in: 'path', required: true, type: 'string' },
      ],
    },
    {
      id: 'get_track',
      description: 'Get a Spotify track by ID',
      method: 'GET',
      path: '/tracks/{id}',
      parameters: [
        { name: 'id', description: 'The Spotify track ID', in: 'path', required: true, type: 'string' },
      ],
    },
    {
      id: 'get_artist',
      description: 'Get a Spotify artist by ID',
      method: 'GET',
      path: '/artists/{id}',
      parameters: [
        { name: 'id', description: 'The Spotify artist ID', in: 'path', required: true, type: 'string' },
      ],
    },
    {
      id: 'get_artist_top_tracks',
      description: 'Get an artist\'s top tracks',
      method: 'GET',
      path: '/artists/{id}/top-tracks',
      parameters: [
        { name: 'id', description: 'The Spotify artist ID', in: 'path', required: true, type: 'string' },
        { name: 'market', description: 'ISO 3166-1 alpha-2 country code (e.g. US)', in: 'query', required: false, type: 'string', default: 'US' },
      ],
    },
    {
      id: 'get_recommendations',
      description: 'Get track recommendations based on seed artists, tracks, or genres',
      method: 'GET',
      path: '/recommendations',
      parameters: [
        { name: 'seed_artists', description: 'Comma-separated artist IDs (up to 5 total seeds)', in: 'query', required: false, type: 'string' },
        { name: 'seed_tracks', description: 'Comma-separated track IDs (up to 5 total seeds)', in: 'query', required: false, type: 'string' },
        { name: 'seed_genres', description: 'Comma-separated genres (up to 5 total seeds)', in: 'query', required: false, type: 'string' },
        { name: 'limit', description: 'Max results (1-100)', in: 'query', required: false, type: 'integer', default: 20 },
      ],
    },
  ],
};
