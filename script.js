/**
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

(async () => {
  // Check for Language Detector API support
  if (!('LanguageDetector' in self) && !('ai' in self) && !('languageDetector' in self)) {
    document.querySelector('.not-supported-message').hidden = false;
    return;
  }

  const input = document.querySelector('#input');
  const output = document.querySelector('#output');
  const form = document.querySelector('form');
  const detected = document.querySelector('.language-detection span');
  const language = document.querySelector('#translate');
  const translateButton = document.querySelector('.translate-btn');
  const speakButton = document.querySelector('#speak');
  const loader = document.createElement('div');
  loader.className = 'loader';
  output.parentNode.insertBefore(loader, output);

  form.style.visibility = 'visible';
  const detector = await
      ('LanguageDetector' in self ? LanguageDetector.create() : ai.languageDetector.create());

  input.addEventListener('input', async () => {
    if (!input.value.trim()) {
      detected.textContent = 'not sure what language this is';
      translateButton.disabled = true;
      if (speakButton) speakButton.disabled = true;
      return;
    }
    translateButton.disabled = false;
    const { detectedLanguage, confidence } = (
      await detector.detect(input.value.trim())
    )[0];
    detected.textContent = `${(confidence * 100).toFixed(
      1
    )}% sure this is ${languageTagToHumanReadable(
      detectedLanguage,
      'en'
    )}`;
  });

  input.dispatchEvent(new Event('input'));

  const languageTagToHumanReadable = (languageTag, targetLanguage) => {
    const displayNames = new Intl.DisplayNames([targetLanguage], {
      type: 'language',
    });
    return displayNames.of(languageTag);
  };

  // Speech Synthesis Setup
  let voices = [];
  let speechSupported = 'speechSynthesis' in window;
  if (speechSupported) {
    const updateVoices = () => {
      voices = speechSynthesis.getVoices();
      console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })));
      if (speakButton && voices.length === 0) {
        speakButton.disabled = true;
        output.textContent = 'No voices available for speech synthesis.';
      }
    };
    updateVoices();
    speechSynthesis.onvoiceschanged = () => {
      updateVoices();
      if (speakButton && voices.length > 0) speakButton.disabled = false;
    };
  } else {
    if (speakButton) {
      speakButton.disabled = true;
      output.textContent = 'Speech synthesis not supported in this browser.';
    }
  }

  const getVoiceForLanguage = (lang) => {
    const languageMap = {
      en: ['en-US', 'en-GB'],
      ja: ['ja-JP'],
      es: ['es-ES', 'es-MX'],
      pt: ['pt-PT', 'pt-BR'],
      ru: ['ru-RU'],
      tr: ['tr-TR'],
      fr: ['fr-FR', 'fr-CA']
    };
    const possibleLocales = languageMap[lang] || [lang];
    const voice = voices.find(voice => possibleLocales.includes(voice.lang)) || voices.find(voice => voice.lang.startsWith(lang)) || voices[0];
    console.log(`Selected voice for ${lang}:`, voice ? { name: voice.name, lang: voice.lang } : 'None');
    return voice;
  };

  let currentUtterance = null;

  // Translator API Logic
  if ('Translator' in self || ('ai' in self && 'translator' in self.ai)) {
    document.querySelectorAll('[hidden]:not(.not-supported-message)').forEach((el) => {
      el.removeAttribute('hidden');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      translateButton.disabled = true;
      if (speakButton) speakButton.disabled = true;
      output.textContent = '';
      loader.style.display = 'block';
      try {
        const sourceLanguage = (await detector.detect(input.value.trim()))[0].detectedLanguage;
        if (!['en', 'ja', 'es', 'pt', 'ru', 'tr', 'fr'].includes(sourceLanguage)) {
          output.textContent = 'Currently, only English ↔ Spanish and English ↔ Japanese are supported.';
          loader.style.display = 'none';
          translateButton.disabled = false;
          if (speakButton) speakButton.disabled = true;
          return;
        }
        const targetLanguage = language.value;
        const translator = await ('Translator' in self ?
            Translator.create({ sourceLanguage, targetLanguage }) :
            ai.translator.create({ sourceLanguage, targetLanguage }));
        const translatedText = await translator.translate(input.value.trim());
        output.textContent = translatedText;
        loader.style.display = 'none';
        translateButton.disabled = false;
        if (speakButton && speechSupported && voices.length > 0) {
          speakButton.disabled = false;
        }

        if (speakButton && speechSupported) {
          speakButton.onclick = () => {
            if (currentUtterance && speechSynthesis.speaking) {
              speechSynthesis.cancel();
              currentUtterance = null;
              speakButton.textContent = 'Listen';
              speakButton.classList.remove('stop');
              const playIconPath = speakButton.querySelector('svg path');
              if (playIconPath) {
                playIconPath.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5z');
              }
            } else {
              currentUtterance = new SpeechSynthesisUtterance(translatedText);
              const voice = getVoiceForLanguage(targetLanguage);
              if (voice) {
                currentUtterance.voice = voice;
                currentUtterance.lang = voice.lang;
              } else {
                currentUtterance.lang = targetLanguage;
                output.textContent = `${translatedText} (No matching voice for ${languageTagToHumanReadable(targetLanguage, 'en')}, using default voice);`
              }
              currentUtterance.rate = 1.0;
              currentUtterance.pitch = 1.0;
              currentUtterance.onend = () => {
                currentUtterance = null;
                speakButton.textContent = 'Listen';
                speakButton.classList.remove('stop');
                const playIconPath = speakButton.querySelector('svg path');
                if (playIconPath) {
                  playIconPath.setAttribute('d', 'M11 5L6 9H2v6h4l5 4V5z');
                }
              };
              speakButton.textContent = 'Stop';
              speakButton.classList.add('stop');
              const stopIconPath = speakButton.querySelector('svg path');
              if (stopIconPath) {
                stopIconPath.setAttribute('d', 'M6 6h12v12H6z');
              }
              speechSynthesis.speak(currentUtterance);
            }
          };
        }
      } catch (err) {
        output.textContent = 'An error occurred. Please try again.';
        console.error(err.name, err.message);
        loader.style.display = 'none';
        translateButton.disabled = false;
        if (speakButton) speakButton.disabled = true;
      }
    });
  }
})();