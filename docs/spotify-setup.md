# Konfiguracja Spotify (Sekcja Playlista)

Sekcja **Playlista** używa Spotify Web API. Cały ruch do Spotify idzie przez
serwer — w przeglądarce nie ma żadnych kluczy.

## 1. Załóż aplikację w Spotify

1. Wejdź na <https://developer.spotify.com/dashboard> i zaloguj się.
2. Kliknij **Create app**.
3. Wypełnij:
   - **App name**: np. `Swiateczna Tablica`
   - **Description**: dowolny
   - **Website URL**: adres Twojej aplikacji
   - **Redirect URIs**: `https://<TwojaDomena>/spotify/callback`
     (przy lokalnym testowaniu dodatkowo `http://localhost:3000/spotify/callback`)
4. **Scopes** (wystarczą domyślne; aplikacja używa):
   - `playlist-read-private`
   - `playlist-modify-private`
   - `playlist-modify-public`
5. Zapisz. Skopiuj **Client ID** i **Client Secret** (Secret widać po
   kliknięciu *View client secret*).

## 2. Ustaw zmienne środowiskowe

W środowisku, gdzie działa aplikacja Next.js (np. Vercel → Settings →
Environment Variables, lokalnie `.env.local`):

| Zmienna                  | Wartość                          |
| ------------------------ | -------------------------------- |
| `SPOTIFY_CLIENT_ID`      | Client ID z dashboardu           |
| `SPOTIFY_CLIENT_SECRET`  | Client Secret z dashboardu       |

Klucze są używane wyłącznie po stronie serwera (route handler `/spotify/*`,
server actions, `/api/spotify/search`).

## 3. Uruchom migrację

```
supabase migration up
```

albo w SQL Editor wklej zawartość
`supabase/migrations/0042_spotify_playlist.sql`.

## 4. Użycie

1. Organizator otwiera panel **Playlista** → **Połącz Spotify** → akceptuje
   uprawnienia w oknie Spotify.
2. Organizator tworzy playlistę (przycisk) albo podpiná istniejącą (link).
3. Każdy uczestnik szuka piosenki (albo wkleja link z Spotify) i dodaje —
   maks. 5 utworów na osobę. Utwory lądują od razu na Spotify.
4. Utwór można usunąć (własny) lub ponowić dodanie, gdy pojawi się błąd
   (np. utwór niedostępny w regionie właściciela playlisty).

## Uwagi

- Tokeny Spotify organizatora trzymane są w tabeli `spotify_accounts`
  (RLS: widzi tylko właściciel). Odświeżanie tokena (`refresh_token`)
  dzieje się automatycznie po stronie serwera.
- Jeśli Spotify zwróci błąd przy odświeżaniu (np. odwołany dostęp), organizator
  zobaczy brak połączenia i może połączyć konto ponownie.
- Playlista tworzona przez aplikację jest **prywatna** — organizator może ją
  zmienić w Spotify.
- Zmiana konta Spotify (rozłącz → połącz inne) wymaga ponownego utworzenia lub
  podpięcia playlisty.
