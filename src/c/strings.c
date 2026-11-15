#include <pebble.h>
#include "strings.h"

// To add a language: append an entry below (English must stay first, it is
// the fallback) and keep the field order identical to the Strings struct.
static const Strings STRINGS[] = {
  { "en", "+ Add item", "Voice dictation", "Shopping list",
    "Syncing with Bring!...",
    "Set up your Bring! account.\n\nOn your phone: Pebble app > this app > Settings.",
    "Could not reach the phone.\n\nMake sure the Pebble app is open and Bluetooth is connected.",
    "A sync error occurred.",
    "Could not connect to Bring!: check your settings.",
    "Error reading the Bring! list.",
    "Could not log in to Bring!. Check your email and password in Settings.",
    "Your Bring! account has no lists.",
    "No list named \"%s\" was found. Check the name in Settings." },
  { "es", "+ Agregar item", "Dictado por voz", "Lista de compras",
    "Sincronizando con Bring!...",
    "Configura tu cuenta de Bring!\n\nEn el teléfono: app Pebble > esta app > Configuración.",
    "No se pudo conectar con el teléfono.\n\nRevisa que la app Pebble esté abierta y Bluetooth conectado.",
    "Ocurrió un error al sincronizar.",
    "No se pudo conectar con Bring!: revisa tu configuración.",
    "Error al leer la lista de Bring!",
    "No se pudo iniciar sesión en Bring!. Revisa tu email y contraseña desde Configuración.",
    "Tu cuenta de Bring! no tiene listas.",
    "No se encontró una lista llamada \"%s\". Revisa el nombre desde Configuración." },
  { "de", "+ Artikel hinzufügen", "Spracheingabe", "Einkaufsliste",
    "Synchronisiere mit Bring!...",
    "Richte dein Bring!-Konto ein.\n\nAuf dem Handy: Pebble-App > diese App > Einstellungen.",
    "Keine Verbindung zum Handy.\n\nPrüfe, ob die Pebble-App geöffnet und Bluetooth verbunden ist.",
    "Beim Synchronisieren ist ein Fehler aufgetreten.",
    "Keine Verbindung zu Bring!: Prüfe deine Einstellungen.",
    "Fehler beim Lesen der Bring!-Liste.",
    "Anmeldung bei Bring! fehlgeschlagen. Prüfe E-Mail und Passwort in den Einstellungen.",
    "Dein Bring!-Konto hat keine Listen.",
    "Keine Liste namens \"%s\" gefunden. Prüfe den Namen in den Einstellungen." },
  { "fr", "+ Ajouter un article", "Dictée vocale", "Liste de courses",
    "Synchronisation avec Bring!...",
    "Configurez votre compte Bring!\n\nSur le téléphone : appli Pebble > cette appli > Paramètres.",
    "Impossible de joindre le téléphone.\n\nVérifiez que l'appli Pebble est ouverte et le Bluetooth connecté.",
    "Une erreur de synchronisation s'est produite.",
    "Connexion à Bring! impossible : vérifiez vos paramètres.",
    "Erreur de lecture de la liste Bring!.",
    "Connexion à Bring! impossible. Vérifiez votre e-mail et mot de passe dans les Paramètres.",
    "Votre compte Bring! n'a aucune liste.",
    "Aucune liste nommée \"%s\". Vérifiez le nom dans les Paramètres." },
  { "it", "+ Aggiungi articolo", "Dettatura vocale", "Lista della spesa",
    "Sincronizzazione con Bring!...",
    "Configura il tuo account Bring!\n\nSul telefono: app Pebble > questa app > Impostazioni.",
    "Impossibile contattare il telefono.\n\nVerifica che l'app Pebble sia aperta e il Bluetooth connesso.",
    "Si è verificato un errore di sincronizzazione.",
    "Impossibile connettersi a Bring!: controlla le impostazioni.",
    "Errore nella lettura della lista di Bring!.",
    "Accesso a Bring! non riuscito. Controlla email e password nelle Impostazioni.",
    "Il tuo account Bring! non ha liste.",
    "Nessuna lista chiamata \"%s\". Controlla il nome nelle Impostazioni." },
  { "pt", "+ Adicionar item", "Ditado por voz", "Lista de compras",
    "Sincronizando com o Bring!...",
    "Configure sua conta do Bring!\n\nNo telefone: app Pebble > este app > Configurações.",
    "Não foi possível conectar ao telefone.\n\nVerifique se o app Pebble está aberto e o Bluetooth conectado.",
    "Ocorreu um erro ao sincronizar.",
    "Não foi possível conectar ao Bring!: verifique suas configurações.",
    "Erro ao ler a lista do Bring!.",
    "Não foi possível entrar no Bring!. Verifique seu e-mail e senha em Configurações.",
    "Sua conta do Bring! não tem listas.",
    "Nenhuma lista chamada \"%s\". Verifique o nome em Configurações." },
};
#define STRINGS_COUNT ((int)(sizeof(STRINGS) / sizeof(STRINGS[0])))

const Strings *strings_for_locale(const char *locale) {
  if (locale) {
    for (int i = 0; i < STRINGS_COUNT; i++) {
      if (strncmp(locale, STRINGS[i].lang, 2) == 0) {
        return &STRINGS[i];
      }
    }
  }
  return &STRINGS[0];
}
