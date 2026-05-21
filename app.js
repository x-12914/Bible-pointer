/**
 * BIBLE POINTER - Core Application Logic
 * Supports 100% Offline Querying, Voice Recognition, and Custom Speech Synthesis.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  let currentBook = null;       // Full Book Object (from BIBLE_DATA)
  let currentChapterNum = null; // 1-indexed Chapter number
  let currentVerseStart = null; // 1-indexed Verse number
  let currentVerseEnd = null;   // 1-indexed End Verse number (for range)
  let activeSpeechUtterance = null;
  let isListening = false;
  let searchMode = 'reference';  // 'reference' or 'reverse'

  // Cache DOM elements
  const bookSelect = document.getElementById('book-select');
  const chapterSelect = document.getElementById('chapter-select');
  const verseSelect = document.getElementById('verse-select');
  const browseBtn = document.getElementById('browse-btn');
  
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchClearBtn = document.getElementById('search-clear-btn');
  
  const modeRefBtn = document.getElementById('mode-ref-btn');
  const modeReverseBtn = document.getElementById('mode-reverse-btn');
  
  const micBtn = document.getElementById('mic-btn');
  const voiceCenter = document.querySelector('.voice-center');
  const speechStatus = document.getElementById('speech-status');
  
  const scriptureCard = document.getElementById('scripture-card');
  const scriptureTitle = document.getElementById('scripture-title');
  const scriptureBody = document.getElementById('scripture-body');
  const cardFooter = document.getElementById('card-footer');
  const prevBtn = document.getElementById('prev-chapter-btn');
  const nextBtn = document.getElementById('next-chapter-btn');
  
  const ttsBtn = document.getElementById('tts-btn');
  const voiceSelect = document.getElementById('voice-select');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const bookmarksList = document.getElementById('bookmarks-list');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');
  const displayTitleInput = document.getElementById('display-title-input');

  // ==========================================================================
  // WORD-TO-NUMBER CONVERTER FOR SPOKEN VOICE REFERENCE PARSING
  // ==========================================================================
  const textNumberMap = {
    'zero': 0, 'one': 1, 'first': 1, 'two': 2, 'second': 2, 'three': 3, 'third': 3,
    'four': 4, 'fourth': 4, 'five': 5, 'fifth': 5, 'six': 6, 'sixth': 6, 'seven': 7, 'seventh': 7,
    'eight': 8, 'eighth': 8, 'nine': 9, 'ninth': 9, 'ten': 10, 'tenth': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100
  };

  function parseSpokenNumbers(text) {
    const words = text.toLowerCase()
      .replace(/[-]+/g, ' ')
      .replace(/\band\b/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const out = [];
    let i = 0;

    while (i < words.length) {
      if (textNumberMap[words[i]] === undefined) {
        out.push(words[i]);
        i++;
        continue;
      }

      // Consume a run of number words, splitting it into the correct sequence of
      // numbers. "twenty three" -> 23 (tens + unit), but "three sixteen" -> 3 16
      // (two separate numbers, e.g. chapter 3 verse 16). "one hundred nineteen"
      // -> 119. This is what lets spoken refs like "John three sixteen" work.
      let current = 0;
      let has = false;
      const flush = () => { if (has) { out.push(String(current)); current = 0; has = false; } };

      while (i < words.length && textNumberMap[words[i]] !== undefined) {
        const w = words[i];
        const v = textNumberMap[w];
        if (w === 'hundred') {
          current = (current === 0 ? 1 : current) * 100;
          has = true;
        } else if (v >= 20 && v <= 90) {            // tens word
          if (has && current % 100 !== 0) flush();  // e.g. "twenty thirty" -> 20 30
          current += v;
          has = true;
        } else {                                     // unit (1-9) or teen (10-19)
          const isUnit = v <= 9;
          const attaches = has && current > 0 && (
            (isUnit && current % 10 === 0) ||        // "twenty three"->23, "hundred twenty three"->123
            (!isUnit && current % 100 === 0)         // "one hundred nineteen"->119
          );
          if (attaches) {
            current += v;
          } else {
            flush();                                 // "three sixteen"->3 16, "twenty one four"->21 4
            current = v;
            has = true;
          }
        }
        i++;
      }
      flush();
    }

    return out.join(' ');
  }

  // Book abbreviation mapping for robust search parsing
  const bookAbbreviations = {
    'gen': 'Genesis', 'genesis': 'Genesis',
    'ex': 'Exodus', 'exod': 'Exodus', 'exodus': 'Exodus',
    'lev': 'Leviticus', 'levit': 'Leviticus', 'leviticus': 'Leviticus',
    'num': 'Numbers', 'numb': 'Numbers', 'numbers': 'Numbers',
    'deut': 'Deuteronomy', 'deuter': 'Deuteronomy', 'deuteronomy': 'Deuteronomy',
    'josh': 'Joshua', 'joshua': 'Joshua',
    'judg': 'Judges', 'judges': 'Judges',
    'ruth': 'Ruth',
    '1 sam': '1 Samuel', '1samuel': '1 Samuel', '1sam': '1 Samuel',
    '2 sam': '2 Samuel', '2samuel': '2 Samuel', '2sam': '2 Samuel',
    '1 kings': '1 Kings', '1kings': '1 Kings',
    '2 kings': '2 Kings', '2kings': '2 Kings',
    '1 chron': '1 Chronicles', '1 ch': '1 Chronicles', '1chron': '1 Chronicles',
    '2 chron': '2 Chronicles', '2 ch': '2 Chronicles', '2chron': '2 Chronicles',
    'ezra': 'Ezra',
    'neh': 'Nehemiah', 'nehem': 'Nehemiah', 'nehemiah': 'Nehemiah',
    'esth': 'Esther', 'esther': 'Esther',
    'job': 'Job',
    'ps': 'Psalms', 'psa': 'Psalms', 'psal': 'Psalms', 'psalm': 'Psalms', 'psalms': 'Psalms',
    'prov': 'Proverbs', 'proverb': 'Proverbs', 'proverbs': 'Proverbs',
    'eccl': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ecclesiastes': 'Ecclesiastes',
    'song': 'Song of Solomon', 'solomon': 'Song of Solomon', 'canticles': 'Song of Solomon',
    'isa': 'Isaiah', 'isaiah': 'Isaiah',
    'jer': 'Jeremiah', 'jerem': 'Jeremiah', 'jeremiah': 'Jeremiah',
    'lam': 'Lamentations', 'lament': 'Lamentations', 'lamentations': 'Lamentations',
    'ezek': 'Ezekiel', 'ezekiel': 'Ezekiel',
    'dan': 'Daniel', 'daniel': 'Daniel',
    'hos': 'Hosea', 'hosea': 'Hosea',
    'joel': 'Joel',
    'amos': 'Amos',
    'obad': 'Obadiah', 'obadiah': 'Obadiah',
    'jonah': 'Jonah',
    'mic': 'Micah', 'micah': 'Micah',
    'nah': 'Nahum', 'nahum': 'Nahum',
    'hab': 'Habakkuk', 'habakkuk': 'Habakkuk',
    'zeph': 'Zephaniah', 'zephaniah': 'Zephaniah',
    'hag': 'Haggai', 'haggai': 'Haggai',
    'zech': 'Zechariah', 'zechariah': 'Zechariah',
    'mal': 'Malachi', 'malachi': 'Malachi',
    'matt': 'Matthew', 'matthew': 'Matthew',
    'mark': 'Mark',
    'luke': 'Luke',
    'john': 'John', 'jn': 'John',
    'acts': 'Acts',
    'rom': 'Romans', 'romans': 'Romans',
    '1 cor': '1 Corinthians', '1cor': '1 Corinthians', '1corinthians': '1 Corinthians',
    '2 cor': '2 Corinthians', '2cor': '2 Corinthians', '2corinthians': '2 Corinthians',
    'gal': 'Galatians', 'galat': 'Galatians', 'galatians': 'Galatians',
    'eph': 'Ephesians', 'ephes': 'Ephesians', 'ephesians': 'Ephesians',
    'phil': 'Philippians', 'philipp': 'Philippians', 'philippians': 'Philippians',
    'col': 'Colossians', 'colos': 'Colossians', 'colossians': 'Colossians',
    '1 thess': '1 Thessalonians', '1thess': '1 Thessalonians', '1thessalonians': '1 Thessalonians',
    '2 thess': '2 Thessalonians', '2thess': '2 Thessalonians', '2thessalonians': '2 Thessalonians',
    '1 tim': '1 Timothy', '1tim': '1 Timothy', '1timothy': '1 Timothy',
    '2 tim': '2 Timothy', '2tim': '2 Timothy', '2timothy': '2 Timothy',
    'tit': 'Titus', 'titus': 'Titus',
    'philem': 'Philemon', 'philemon': 'Philemon',
    'heb': 'Hebrews', 'hebrew': 'Hebrews', 'hebrews': 'Hebrews',
    'jas': 'James', 'james': 'James',
    '1 pet': '1 Peter', '1pet': '1 Peter', '1peter': '1 Peter',
    '2 pet': '2 Peter', '2pet': '2 Peter', '2peter': '2 Peter',
    '1 jn': '1 John', '1jn': '1 John', '1john': '1 John',
    '2 jn': '2 John', '2jn': '2 John', '2john': '2 John',
    '3 jn': '3 John', '3jn': '3 John', '3john': '3 John',
    'jude': 'Jude',
    'rev': 'Revelation', 'revel': 'Revelation', 'revelation': 'Revelation', 'revelations': 'Revelation'
  };

  // ==========================================================================
  // INITIALIZE BIBLE DATA & DROPDOWNS
  // ==========================================================================
  function initApp() {
    if (typeof BIBLE_DATA === 'undefined') {
      showToast("Error: Offline Bible data not found. Please reload.");
      scriptureBody.innerHTML = `<p class="error-msg">Failed to load offline Bible data. Make sure 'bible-data.js' exists in your directory.</p>`;
      return;
    }

    // Populate Book Select
    bookSelect.innerHTML = '';
    BIBLE_DATA.forEach((book, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = book.name;
      bookSelect.appendChild(option);
    });

    // Wire up dynamic dropdown cascade events
    bookSelect.addEventListener('change', updateChapterDropdown);
    chapterSelect.addEventListener('change', updateVerseDropdown);

    // Wire up Search Mode Toggles
    modeRefBtn.onclick = () => {
      searchMode = 'reference';
      modeRefBtn.classList.add('active');
      modeReverseBtn.classList.remove('active');
      searchInput.value = '';
      toggleClearBtn();
      searchInput.placeholder = "Type reference... (e.g. Gen 1:1, Matt 12:2-5, Psalms 23)";
      searchInput.focus();
    };

    modeReverseBtn.onclick = () => {
      searchMode = 'reverse';
      modeReverseBtn.classList.add('active');
      modeRefBtn.classList.remove('active');
      searchInput.value = '';
      toggleClearBtn();
      searchInput.placeholder = "Enter words or phrase to search... (e.g. 'faith hope charity')";
      searchInput.focus();
    };

    // Initial population
    updateChapterDropdown();
    
    // Load local history & bookmarks
    renderHistory();
    renderBookmarks();

    // Setup Presentation default title configuration
    const storedDefaultTitle = localStorage.getItem('bible_display_default_title') || "Welcome to Bible Pointer";
    if (displayTitleInput) {
      displayTitleInput.value = storedDefaultTitle;
      displayTitleInput.addEventListener('input', () => {
        const newTitle = displayTitleInput.value.trim() || "Welcome to Bible Pointer";
        localStorage.setItem('bible_display_default_title', newTitle);
        
        try {
          const bc = new BroadcastChannel('bible_pointer_channel');
          bc.postMessage({
            type: 'update_default_title',
            title: newTitle
          });
        } catch (e) {
          console.warn("BroadcastChannel failed:", e);
        }
      });
    }
  }

  function updateChapterDropdown() {
    const bookIndex = bookSelect.value;
    const book = BIBLE_DATA[bookIndex];
    
    chapterSelect.innerHTML = '';
    book.chapters.forEach((chapter, index) => {
      const option = document.createElement('option');
      option.value = index + 1;
      option.textContent = `Chapter ${index + 1}`;
      chapterSelect.appendChild(option);
    });
    
    updateVerseDropdown();
  }

  function updateVerseDropdown() {
    const bookIndex = bookSelect.value;
    const book = BIBLE_DATA[bookIndex];
    const chapterIndex = parseInt(chapterSelect.value) - 1;
    
    verseSelect.innerHTML = '';
    
    // Add "All" option for reading whole chapter
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Verses';
    verseSelect.appendChild(allOption);

    if (isNaN(chapterIndex) || chapterIndex < 0 || !book.chapters[chapterIndex]) return;

    book.chapters[chapterIndex].forEach((verse, index) => {
      const option = document.createElement('option');
      option.value = index + 1;
      option.textContent = `Verse ${index + 1}`;
      verseSelect.appendChild(option);
    });
  }

  // ==========================================================================
  // CORE QUERY PARSER & LOOKUP
  // ==========================================================================
  function handleManualSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    if (searchMode === 'reference') {
      parseAndFetchReference(query);
    } else {
      executeReverseSearch(query);
    }
  }

  /**
   * Concordance Search: Looks up keywords or phrases offline through all 66 books,
   * highlights findings, and displays a clickable results list.
   */
  function executeReverseSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery.length < 2) {
      showToast("Search term is too short. Enter at least 2 characters.");
      return;
    }

    // Escape special regex characters safely
    const escapedQuery = lowerQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    const matches = [];
    const maxResults = 80; // Cap to keep render fast & snappy

    // Search BIBLE_DATA
    for (let b = 0; b < BIBLE_DATA.length; b++) {
      const book = BIBLE_DATA[b];
      for (let c = 0; c < book.chapters.length; c++) {
        const chapter = book.chapters[c];
        for (let v = 0; v < chapter.length; v++) {
          const verseText = chapter[v];
          if (verseText.toLowerCase().includes(lowerQuery)) {
            matches.push({
              book: book,
              chapterNum: c + 1,
              verseNum: v + 1,
              text: verseText
            });
            if (matches.length >= maxResults) break;
          }
        }
        if (matches.length >= maxResults) break;
      }
      if (matches.length >= maxResults) break;
    }

    // Stop active reading aloud
    stopTTS();
    
    // Set viewer card header
    scriptureTitle.textContent = `Search: "${query}"`;
    
    // Save to search log history
    saveSearchToHistory(query);

    // Reset card button states for results page
    ttsBtn.disabled = true;
    bookmarkBtn.disabled = true;
    cardFooter.style.display = 'none';

    if (matches.length === 0) {
      scriptureBody.innerHTML = `
        <p class="intro-p" style="text-align: center; margin-top: 3rem; color: var(--color-text-muted);">
          No matching verses found for "${query}".
        </p>
        <p class="intro-p" style="text-align: center; font-size: 0.95rem;">
          Try searching for different keywords like: <strong class="glow-txt">"faith"</strong>, <strong class="glow-txt">"loved the world"</strong>, or <strong class="glow-txt">"covenant"</strong>.
        </p>`;
      return;
    }

    let htmlContent = `
      <div class="search-results-container">
        <div class="search-result-count">Found ${matches.length}${matches.length >= maxResults ? '+' : ''} matching verses:</div>
    `;

    matches.forEach((m, idx) => {
      // Wrap matching terms in glowing gold tag
      const highlightedText = m.text.replace(regex, '<mark class="highlight-gold">$1</mark>');
      
      htmlContent += `
        <div class="search-result-item" data-idx="${idx}">
          <div class="result-header">
            <span class="result-reference">${m.book.name} ${m.chapterNum}:${m.verseNum}</span>
            <span class="result-chapter-link">Read Chapter &rarr;</span>
          </div>
          <div class="result-text">"${highlightedText}"</div>
        </div>
      `;
    });

    htmlContent += `</div>`;
    scriptureBody.innerHTML = htmlContent;
    scriptureBody.scrollTop = 0;

    // Attach click handlers to jump directly to verse context on result click
    const resultElements = scriptureBody.querySelectorAll('.search-result-item');
    resultElements.forEach(elem => {
      elem.onclick = () => {
        const idx = parseInt(elem.getAttribute('data-idx'));
        const match = matches[idx];
        
        // Load target scripture
        renderScripture(match.book, match.chapterNum, match.verseNum);
        
        // Revert toggle back to standard reference reader
        searchMode = 'reference';
        modeRefBtn.classList.add('active');
        modeReverseBtn.classList.remove('active');
        searchInput.placeholder = "Type reference... (e.g. Gen 1:1, Matt 12:2-5, Psalms 23)";
      };
    });
  }

  function handleBrowseSelection() {
    const bookIndex = bookSelect.value;
    const book = BIBLE_DATA[bookIndex];
    const chapterNum = parseInt(chapterSelect.value);
    const verseVal = verseSelect.value;
    
    if (verseVal === 'all') {
      renderScripture(book, chapterNum);
    } else {
      const verseNum = parseInt(verseVal);
      renderScripture(book, chapterNum, verseNum);
    }
  }

  /**
   * Main Intelligent Parser: Standardizes text and spoken voice queries,
   * extracts Book, Chapter, Verse, and optional Verse Range.
   */
  let lastExtractedRefKey = '';
  let lastMatchIndex = -1;
  let lastQueryLength = 0;

  function extractBibleReference(rawQuery) {
    if (!rawQuery) return null;
    
    // If the new query is shorter than the previous one, it means the speech engine has restarted/wiped the transcript
    if (rawQuery.length < lastQueryLength) {
      lastMatchIndex = -1;
      lastExtractedRefKey = '';
    }
    lastQueryLength = rawQuery.length;
    
    // 1. Standarise numbers in voice transcript (e.g. "three" -> "3")
    let query = parseSpokenNumbers(rawQuery);
    
    // 2. Clean structural voice words (e.g., "chapter", "verse", "verses", "to")
    query = query.toLowerCase()
      .replace(/\bchapter\s*/gi, ' ')
      .replace(/\bverses\s*/gi, ':')
      .replace(/\bverse\s*/gi, ':')
      .replace(/\bto\s*/gi, '-')
      .replace(/\bthrough\s*/gi, '-')
      .replace(/\b-\s*/gi, '-')
      .replace(/[.,\/#!$%\^&\*;{}=\_`~()?]/g, (match) => {
        return (match === ':' || match === '-') ? match : '';
      })
      .replace(/\s+/g, ' ')
      .trim();

    // Compile list of book names and abbreviations sorted by length descending
    const bookNames = BIBLE_DATA.map(b => b.name.toLowerCase());
    const abbrevKeys = Object.keys(bookAbbreviations);
    const allPatterns = [...bookNames, ...abbrevKeys].sort((a, b) => b.length - a.length);
    
    const bookRegexPattern = '(' + allPatterns.map(p => p.replace(/\s+/g, '\\s*')).join('|') + ')';
    const refRegex = new RegExp(`${bookRegexPattern}\\s*(\\d+)(?:[\\s:]+(\\d+))?(?:\\s*-\\s*(\\d+))?`, 'gi');
    
    let lastMatch = null;
    let match;
    while ((match = refRegex.exec(query)) !== null) {
      lastMatch = match;
    }

    if (lastMatch) {
      const matchIndex = lastMatch.index;
      const spokenBook = lastMatch[1].trim();
      const chapterNum = parseInt(lastMatch[2]);
      const verseStart = lastMatch[3] ? parseInt(lastMatch[3]) : null;
      const verseEnd = lastMatch[4] ? parseInt(lastMatch[4]) : null;
      
      const resolvedBookName = bookAbbreviations[spokenBook] || bookAbbreviations[spokenBook.replace(/\s+/g, '')];
      let bookObj = null;
      
      if (resolvedBookName) {
        bookObj = BIBLE_DATA.find(b => b.name.toLowerCase() === resolvedBookName.toLowerCase());
      } else {
        bookObj = BIBLE_DATA.find(b => b.name.toLowerCase() === spokenBook) || 
                  BIBLE_DATA.find(b => b.name.toLowerCase().startsWith(spokenBook));
      }
      
      if (bookObj) {
        const refKey = `${bookObj.name}-${chapterNum}-${verseStart || 'all'}-${verseEnd || 'none'}`;
        if (matchIndex > lastMatchIndex || refKey !== lastExtractedRefKey) {
          lastMatchIndex = matchIndex;
          lastExtractedRefKey = refKey;
          return {
            book: bookObj,
            chapter: chapterNum,
            verseStart: verseStart,
            verseEnd: verseEnd,
            matchedText: lastMatch[0]
          };
        }
      }
    }
    
    return null;
  }

  function parseAndFetchReference(rawQuery) {
    const extracted = extractBibleReference(rawQuery);
    if (extracted) {
      executeFetch(extracted.book, extracted.chapter, extracted.verseStart, extracted.verseEnd, rawQuery);
      return;
    }

    // Intelligent Fallback: If spoken query is not a structured reference, auto-route to keyword reverse search!
    console.log("Reference pattern match failed. Auto-routing to reverse keyword search:", rawQuery);
    searchMode = 'reverse';
    modeRefBtn.classList.remove('active');
    modeReverseBtn.classList.add('active');
    searchInput.placeholder = "Search keywords... (e.g. faith, love, grace)";
    executeReverseSearch(rawQuery);
  }

  function executeFetch(book, chapterNum, verseStart, verseEnd, originalQuery) {
    // Basic boundary checks
    if (chapterNum > book.chapters.length || chapterNum < 1) {
      showToast(`Chapter ${chapterNum} not found in ${book.name}. (Has ${book.chapters.length} chapters)`);
      return;
    }

    const chapterIndex = chapterNum - 1;
    const versesInChapter = book.chapters[chapterIndex].length;

    if (verseStart !== null && (verseStart > versesInChapter || verseStart < 1)) {
      showToast(`Verse ${verseStart} not found in ${book.name} Chapter ${chapterNum}. (Has ${versesInChapter} verses)`);
      return;
    }

    if (verseEnd !== null && (verseEnd > versesInChapter || verseEnd < 1 || verseEnd < verseStart)) {
      showToast(`Invalid verse range in Chapter ${chapterNum}. (Has ${versesInChapter} verses)`);
      return;
    }

    // Success! Render the scriptures
    renderScripture(book, chapterNum, verseStart, verseEnd);
    
    // Add to history list
    saveSearchToHistory(originalQuery);
  }

  // ==========================================================================
  // RENDER SCRIPTURE & UPDATE VIEW STATE
  // ==========================================================================
  function renderScripture(book, chapterNum, verseStart = null, verseEnd = null) {
    // Update local state
    currentBook = book;
    currentChapterNum = chapterNum;
    currentVerseStart = verseStart;
    currentVerseEnd = verseEnd;

    // Format title
    let titleText = `${book.name} ${chapterNum}`;
    if (verseStart !== null) {
      titleText += `:${verseStart}`;
      if (verseEnd !== null) {
        titleText += `-${verseEnd}`;
      }
    }

    scriptureTitle.textContent = titleText;
    
    // Enable Actions
    ttsBtn.disabled = false;
    bookmarkBtn.disabled = false;
    
    // Stop any currently speaking TTS
    stopTTS();

    // Check bookmark state
    updateBookmarkButtonState();

    // Extract verse strings
    const chapterIndex = chapterNum - 1;
    const versesArr = book.chapters[chapterIndex];
    let htmlContent = '';

    if (verseStart === null) {
      // Whole chapter
      versesArr.forEach((verseText, index) => {
        htmlContent += `
          <div class="verse-block">
            <span class="verse-num">${index + 1}</span>
            <span class="verse-text">${verseText}</span>
          </div>`;
      });
      cardFooter.style.display = 'flex'; // Enable chapter pagination
    } else if (verseEnd === null) {
      // Single verse
      const verseText = versesArr[verseStart - 1];
      htmlContent += `
        <div class="verse-block">
          <span class="verse-num">${verseStart}</span>
          <span class="verse-text">${verseText}</span>
        </div>`;
      cardFooter.style.display = 'flex';
    } else {
      // Verse range
      for (let i = verseStart; i <= verseEnd; i++) {
        const verseText = versesArr[i - 1];
        htmlContent += `
          <div class="verse-block">
            <span class="verse-num">${i}</span>
            <span class="verse-text">${verseText}</span>
          </div>`;
      }
      cardFooter.style.display = 'flex';
    }

    scriptureBody.innerHTML = htmlContent;
    scriptureBody.scrollTop = 0; // Scroll back to top

    // Sync sidebar selector values to match rendered view
    const bookIndex = BIBLE_DATA.findIndex(b => b.name === book.name);
    bookSelect.value = bookIndex;
    updateChapterDropdown();
    chapterSelect.value = chapterNum;
    updateVerseDropdown();
    verseSelect.value = verseStart !== null ? verseStart : 'all';

    // Broadcast via BroadcastChannel to presentation tab
    try {
      const broadcastVerses = [];
      if (verseStart === null) {
        versesArr.forEach((verseText, index) => {
          broadcastVerses.push({ number: index + 1, text: verseText });
        });
      } else if (verseEnd === null) {
        broadcastVerses.push({ number: verseStart, text: versesArr[verseStart - 1] });
      } else {
        for (let i = verseStart; i <= verseEnd; i++) {
          broadcastVerses.push({ number: i, text: versesArr[i - 1] });
        }
      }
      const bc = new BroadcastChannel('bible_pointer_channel');
      bc.postMessage({
        type: 'update_scripture',
        title: titleText,
        verses: broadcastVerses
      });
    } catch (e) {
      console.warn("BroadcastChannel failed:", e);
    }
  }

  // Chapter Navigation (Next/Prev buttons)
  prevBtn.onclick = () => {
    if (!currentBook) return;
    let targetChapter = currentChapterNum - 1;
    if (targetChapter < 1) {
      // Go to previous book's last chapter
      const bookIndex = BIBLE_DATA.findIndex(b => b.name === currentBook.name);
      if (bookIndex > 0) {
        const prevBook = BIBLE_DATA[bookIndex - 1];
        renderScripture(prevBook, prevBook.chapters.length);
      } else {
        showToast("Already at the beginning of the Bible.");
      }
    } else {
      renderScripture(currentBook, targetChapter);
    }
  };

  nextBtn.onclick = () => {
    if (!currentBook) return;
    let targetChapter = currentChapterNum + 1;
    if (targetChapter > currentBook.chapters.length) {
      // Go to next book's first chapter
      const bookIndex = BIBLE_DATA.findIndex(b => b.name === currentBook.name);
      if (bookIndex < BIBLE_DATA.length - 1) {
        const nextBook = BIBLE_DATA[bookIndex + 1];
        renderScripture(nextBook, 1);
      } else {
        showToast("Already at the end of the Bible.");
      }
    } else {
      renderScripture(currentBook, targetChapter);
    }
  };

  // ==========================================================================
  // TEXT-TO-SPEECH READER (OFFLINE NATIVE SPEECH SYNTHESIS)
  // ==========================================================================
  // Warm up system voices immediately for asynchronous loading
  let systemVoices = [];
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
        populateVoicesDropdown();
      };
    }
    // Fire immediate check in case they are already pre-loaded
    setTimeout(populateVoicesDropdown, 200);
  }

  ttsBtn.addEventListener('click', toggleTTS);
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        stopTTS();
        startTTS();
      }
    });
  }

  function populateVoicesDropdown() {
    if (!window.speechSynthesis || !voiceSelect) return;
    const allVoices = window.speechSynthesis.getVoices();
    
    // Keep English options exclusively to maintain clear scripture reading
    systemVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith('en'));
    
    // Sort so premium natural, neural, or prioritized names appear at the top
    const priorityKeywords = ['natural', 'neural', 'google', 'jenny', 'aria', 'samantha', 'zira', 'hazel', 'david'];
    systemVoices.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      const aHasPriority = priorityKeywords.some(keyword => aName.includes(keyword));
      const bHasPriority = priorityKeywords.some(keyword => bName.includes(keyword));
      
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      
      return a.name.localeCompare(b.name);
    });

    voiceSelect.innerHTML = '';
    
    if (systemVoices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Default Voice';
      voiceSelect.appendChild(opt);
      return;
    }

    systemVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      
      // Clean descriptions
      let displayName = voice.name
        .replace(/microsoft/i, 'MS')
        .replace(/desktop/i, '')
        .replace(/voice/i, '')
        .replace(/online/i, '(Natural Online)')
        .trim();
        
      option.textContent = displayName;
      voiceSelect.appendChild(option);
    });

    // Default to our best recommended natural female voice first
    const defaultFemale = getBestFemaleVoice();
    if (defaultFemale) {
      const defaultIndex = systemVoices.findIndex(v => v.name === defaultFemale.name);
      if (defaultIndex !== -1) {
        voiceSelect.value = defaultIndex;
      }
    }
  }

  function getBestFemaleVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    
    // Ranked preference of highly expressive natural/female voices
    const premiumFemaleKeywords = [
      'natural',  // Microsoft Natural voice variants
      'jenny',    // Premium MS Jenny (female)
      'aria',     // Premium MS Aria (female)
      'samantha', // macOS/iOS Samantha (female)
      'zira',     // Windows Zira Desktop (female)
      'hazel',    // MS Hazel UK (female)
      'sonia',    // MS Sonia (female)
      'susan',    // UK Susan (female)
      'female'    // General tag
    ];

    const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    if (enVoices.length === 0) return null;

    // Search keywords in rank order
    for (const keyword of premiumFemaleKeywords) {
      const match = enVoices.find(v => v.name.toLowerCase().includes(keyword));
      if (match) return match;
    }

    // Fallback to Google US English which is a great female voice
    const googleEn = enVoices.find(v => v.name.toLowerCase().includes('google'));
    if (googleEn) return googleEn;

    // Fallback to any voice name containing typical female terms
    const femalePattern = enVoices.find(v => /female|woman|girl/i.test(v.name));
    if (femalePattern) return femalePattern;

    // Absolute fallback
    return enVoices[0];
  }

  function toggleTTS() {
    if (window.speechSynthesis.speaking) {
      stopTTS();
    } else {
      startTTS();
    }
  }

  function startTTS() {
    if (!currentBook) return;
    
    // Extract full visible plain text
    const verseBlocks = scriptureBody.querySelectorAll('.verse-block');
    let textToSpeak = `${scriptureTitle.textContent}. `;
    
    verseBlocks.forEach(block => {
      const num = block.querySelector('.verse-num').textContent;
      const text = block.querySelector('.verse-text').textContent;
      textToSpeak += `Verse ${num}. ${text} `;
    });

    activeSpeechUtterance = new SpeechSynthesisUtterance(textToSpeak);
    activeSpeechUtterance.lang = 'en-US'; // Helps the browser pick a matching voice
    activeSpeechUtterance.volume = 1.0;
    activeSpeechUtterance.rate = 0.88;    // Deliberate, warm, reverent reading speed
    activeSpeechUtterance.pitch = 1.0;
    
    // Bind selected dropdown voice index
    if (voiceSelect && voiceSelect.value !== '') {
      const selectedIndex = parseInt(voiceSelect.value, 10);
      const chosenVoice = systemVoices[selectedIndex];
      if (chosenVoice) {
        activeSpeechUtterance.voice = chosenVoice;
        console.log("Selected voice from dropdown:", chosenVoice.name);
      }
    } else {
      const femaleVoice = getBestFemaleVoice();
      if (femaleVoice) {
        activeSpeechUtterance.voice = femaleVoice;
      }
    }

    activeSpeechUtterance.onstart = () => {
      ttsBtn.classList.add('speaking');
      ttsBtn.querySelector('.action-btn-text').textContent = 'Pause Reading';
    };

    activeSpeechUtterance.onend = () => {
      resetTTSUI();
    };

    activeSpeechUtterance.onerror = (e) => {
      console.error("Speech Utterance error:", e);
      resetTTSUI();
      
      // Diagnose missing text-to-speech voices
      if (window.speechSynthesis) {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length === 0) {
          showToast("No text-to-speech voices found in this browser. Try Chrome or Edge.", 7000);
        } else {
          showToast("Speech playback failed. Check your system volume and default audio output.");
        }
      } else {
        showToast("Text-to-Speech is not supported in this browser.");
      }
    };

    // Clear any queued/locked utterances before speaking
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(activeSpeechUtterance);
  }

  function stopTTS() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    resetTTSUI();
  }

  function resetTTSUI() {
    ttsBtn.classList.remove('speaking');
    ttsBtn.querySelector('.action-btn-text').textContent = 'Read Aloud';
    activeSpeechUtterance = null;
  }

  // ==========================================================================
  // SPEECH RECOGNITION (DUAL ENGINE)
  // --------------------------------------------------------------------------
  // Preferred:  self-hosted Vosk over a /asr WebSocket — we capture the mic and
  //             stream PCM to the server, which returns transcripts continuously.
  //             One open socket = no restarts = GAPLESS, and works in every
  //             browser (incl. Firefox/Safari/mobile), fully offline.
  // Fallback:   the browser Web Speech API (Chrome/Edge) when no Vosk backend is
  //             reachable (e.g. opened from a plain static server). Cloud-based,
  //             so it needs internet and has brief restart gaps.
  // ==========================================================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const webSpeechSupported = !!SpeechRecognition;
  const VOSK_WS_URL = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/asr';

  let recognition = null;
  let isContinuousListening = false;
  let manualStop = false;       // true when the user (not the engine) stopped it
  let activeEngine = null;      // 'vosk' | 'webspeech' | null
  let restartTimer = null;      // web-speech continuous auto-restart
  let oneShotTimer = null;      // one-shot listening time limit

  // Vosk streaming state
  let voskWS = null, voskCtx = null, voskSource = null, voskProcessor = null, voskStream = null;

  const continuousCheckbox = document.getElementById('continuous-listening-checkbox');

  // ---- Presentation tab --------------------------------------------------
  let presentationWindow = null;
  function openPresentationTab() {
    try {
      if (!presentationWindow || presentationWindow.closed) {
        presentationWindow = window.open('display.html', 'BibleDisplayTab');
      } else {
        presentationWindow.focus();
      }
    } catch (e) {
      console.warn("Popup blocked or failed to open display tab:", e);
    }
  }
  const openDisplayBtn = document.getElementById('open-display-btn');
  if (openDisplayBtn) openDisplayBtn.addEventListener('click', openPresentationTab);

  // The in-app mic picker can't steer either engine reliably, so keep it hidden.
  const micSelectorWrapper = document.getElementById('mic-selector-wrapper');
  if (micSelectorWrapper) micSelectorWrapper.style.display = 'none';

  // ---- Small UI helpers --------------------------------------------------
  function setStatus(text, isError) {
    speechStatus.classList.toggle('error', !!isError);
    speechStatus.textContent = text;
  }
  function showVoiceBars() {
    const v = document.getElementById('voice-visualizer');
    if (v) v.style.display = 'flex';
  }
  function hideVoiceBars() {
    const v = document.getElementById('voice-visualizer');
    if (v) v.style.display = 'none';
    micBtn.style.transform = 'scale(1)';
  }
  function resetMicUI() {
    voiceCenter.classList.remove('listening', 'requesting');
    hideVoiceBars();
  }
  function clearVoiceTimers() {
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    if (oneShotTimer) { clearTimeout(oneShotTimer); oneShotTimer = null; }
  }

  // ---- Shared: turn a transcript into a search ---------------------------
  function handleVoiceText(text, isFinal) {
    text = (text || '').trim();
    if (!text) return;
    searchInput.value = text;
    toggleClearBtn();
    setStatus('Heard: "' + text + '"', false);

    // Only act on FINAL transcripts. Partials are shown as a live caption but not
    // searched — otherwise the view flickers and can momentarily parse the wrong
    // verse (e.g. "John three" before "...sixteen" arrives).
    if (!isFinal) return;

    if (isContinuousListening) {
      const ref = extractBibleReference(text);
      if (ref) {
        openPresentationTab();
        executeFetch(ref.book, ref.chapter, ref.verseStart, ref.verseEnd, text);
      }
    } else {
      if (searchMode === 'reference') parseAndFetchReference(text);
      else executeReverseSearch(text);
    }
  }

  // ---- Audio helpers (for Vosk streaming) --------------------------------
  function downsampleTo16k(input, inRate) {
    if (inRate === 16000) return input;
    const ratio = inRate / 16000;
    const outLen = Math.round(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = idx - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }
  function floatTo16BitPCM(f32) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  // ---- Vosk engine -------------------------------------------------------
  // Returns: 'started' | 'micdenied' | 'nows' (no backend → caller falls back)
  async function voskTryStart() {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && 'WebSocket' in window)) {
      return 'nows';
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.warn("[voice] mic denied/unavailable:", e && e.name);
      isListening = false;
      resetMicUI();
      if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
        setStatus("Microphone blocked. Click the lock icon in the address bar and Allow the mic.", true);
        showToast("Microphone permission denied.");
      } else if (e && (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError')) {
        setStatus("No microphone found. Connect a mic and try again.", true);
      } else {
        setStatus("Microphone error. Check your system mic settings.", true);
      }
      return 'micdenied';
    }

    let ws;
    try { ws = new WebSocket(VOSK_WS_URL); } catch (e) {
      stream.getTracks().forEach(t => t.stop());
      return 'nows';
    }

    const opened = await new Promise(resolve => {
      let done = false;
      const to = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 2500);
      ws.onopen = () => { if (!done) { done = true; clearTimeout(to); resolve(true); } };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(to); resolve(false); } };
    });
    if (!opened) {
      try { ws.close(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      console.log("[voice] no Vosk backend reachable — using browser engine");
      return 'nows';
    }

    console.log("[voice] connected to Vosk backend (gapless, offline)");
    voskWS = ws;
    voskStream = stream;

    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'partial') {
        if (m.text) handleVoiceText(m.text, false);
      } else if (m.type === 'final') {
        console.log("[voice] vosk final:", JSON.stringify(m.text));
        handleVoiceText(m.text, true);
        if (!isContinuousListening) stopVoice();
      }
    };
    ws.onclose = () => {
      if (activeEngine === 'vosk' && isListening && !manualStop) {
        console.warn("[voice] Vosk socket closed unexpectedly");
        isListening = false; activeEngine = null;
        voskStop(); resetMicUI();
        setStatus("Voice connection lost. Click the mic to retry.", true);
      }
    };

    try {
      voskCtx = new (window.AudioContext || window.webkitAudioContext)();
      voskSource = voskCtx.createMediaStreamSource(stream);
      voskProcessor = voskCtx.createScriptProcessor(4096, 1, 1);
      voskProcessor.onaudioprocess = (e) => {
        if (!isListening || !voskWS || voskWS.readyState !== 1) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const ds = downsampleTo16k(f32, voskCtx.sampleRate);
        voskWS.send(floatTo16BitPCM(ds).buffer);
      };
      voskSource.connect(voskProcessor);
      voskProcessor.connect(voskCtx.destination); // outputs silence; needed to fire callback
    } catch (e) {
      console.warn("[voice] audio graph failed, falling back:", e && e.message);
      voskStop();
      return 'nows';
    }

    voiceCenter.classList.remove('requesting');
    voiceCenter.classList.add('listening');
    showVoiceBars();
    setStatus(isContinuousListening
      ? "Constantly listening — say a reference…"
      : "Listening — say a reference clearly…", false);
    showToast("Microphone active (offline voice).");

    if (!isContinuousListening) {
      clearTimeout(oneShotTimer);
      oneShotTimer = setTimeout(() => { if (isListening) stopVoice(); }, 12000);
    }
    return 'started';
  }

  function voskStop() {
    try { if (voskWS && voskWS.readyState === 1) voskWS.send(JSON.stringify({ eof: 1 })); } catch (e) {}
    try { if (voskProcessor) voskProcessor.disconnect(); } catch (e) {}
    try { if (voskSource) voskSource.disconnect(); } catch (e) {}
    try { if (voskCtx && voskCtx.state !== 'closed') voskCtx.close(); } catch (e) {}
    try { if (voskStream) voskStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (voskWS) { voskWS.onclose = null; voskWS.close(); } } catch (e) {}
    voskWS = voskCtx = voskSource = voskProcessor = voskStream = null;
  }

  // ---- Web Speech engine (fallback) --------------------------------------
  function setupWebSpeech() {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("[voice] webspeech onstart");
      voiceCenter.classList.remove('requesting');
      voiceCenter.classList.add('listening');
      showVoiceBars();
      setStatus(isContinuousListening
        ? "Constantly listening — say a reference…"
        : "Listening — say a reference clearly…", false);
      if (!isContinuousListening) {
        clearTimeout(oneShotTimer);
        oneShotTimer = setTimeout(() => {
          if (isListening) { manualStop = true; try { recognition.stop(); } catch (e) {} }
        }, 12000);
      }
    };
    recognition.onspeechstart = () => {
      if (!speechStatus.classList.contains('error')) setStatus("Hearing you…", false);
    };
    recognition.onresult = (event) => {
      let finalText = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' '; else interim += t;
      }
      finalText = finalText.trim();
      const live = (finalText + ' ' + interim).trim();
      if (live) handleVoiceText(live, false);          // live caption only
      if (finalText) handleVoiceText(finalText, true);  // act on finalized speech
    };
    recognition.onerror = (event) => {
      console.warn("[voice] webspeech onerror:", event.error);
      clearVoiceTimers();
      if (isContinuousListening && (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network')) {
        setStatus("Listening… (waiting for speech)", false);
        return;
      }
      if (event.error === 'aborted') return;
      isListening = false; activeEngine = null; resetMicUI();
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          setStatus("Microphone blocked. Click the lock icon in the address bar and Allow the mic.", true);
          showToast("Microphone permission denied.");
          break;
        case 'no-speech':
          setStatus("No speech detected. Check your default mic and speak clearly.", true);
          showToast("No speech detected.");
          break;
        case 'audio-capture':
          setStatus("No microphone available. Close other apps using the mic and try again.", true);
          showToast("Microphone unavailable.");
          break;
        case 'network':
          setStatus("Can't reach the browser speech service — it needs internet.", true);
          showToast("Speech service needs internet.");
          break;
        default:
          setStatus("Voice error (" + event.error + "). Try again or type below.", true);
      }
    };
    function restartContinuous(attempt) {
      if (!(isListening && isContinuousListening && !manualStop)) return;
      try { recognition.start(); }
      catch (e) {
        if ((attempt || 0) < 10) restartTimer = setTimeout(() => restartContinuous((attempt || 0) + 1), 120);
        else { console.warn("[voice] could not restart:", e && e.message); isListening = false; resetMicUI(); setStatus("Voice paused. Click the microphone to resume.", false); }
      }
    }
    recognition.onend = () => {
      console.log("[voice] webspeech onend");
      clearVoiceTimers();
      if (isListening && isContinuousListening && !manualStop) {
        restartTimer = setTimeout(() => restartContinuous(0), 150);
        return;
      }
      isListening = false; manualStop = false; activeEngine = null; resetMicUI();
    };
  }

  function webSpeechStart() {
    if (!recognition) {
      isListening = false; resetMicUI();
      setStatus("Voice unavailable. Start the Vosk server, or use Chrome/Edge with internet.", true);
      return;
    }
    recognition.continuous = isContinuousListening;
    recognition.interimResults = true;
    try { recognition.start(); }
    catch (e) {
      console.warn("[voice] webspeech start threw:", e && e.message);
      isListening = false; resetMicUI();
      setStatus("Couldn't start. Click the microphone again.", true);
    }
  }

  // ---- Orchestration -----------------------------------------------------
  async function startVoice() {
    if (isListening) return;

    // Reset the duplicate-reference guard for a fresh session.
    lastExtractedRefKey = ''; lastMatchIndex = -1; lastQueryLength = 0;
    manualStop = false;
    clearVoiceTimers();
    if (isContinuousListening) openPresentationTab();

    isListening = true;
    voiceCenter.classList.add('requesting');
    setStatus("Starting microphone…", false);

    const result = await voskTryStart();
    if (result === 'started') { activeEngine = 'vosk'; return; }
    if (result === 'micdenied') { activeEngine = null; return; } // error already shown

    // No Vosk backend reachable → fall back to the browser engine.
    if (webSpeechSupported) { activeEngine = 'webspeech'; webSpeechStart(); return; }

    isListening = false; resetMicUI();
    setStatus("Voice unavailable here. Run the Vosk server, or open in Chrome/Edge with internet.", true);
  }

  function stopVoice() {
    manualStop = true;
    clearVoiceTimers();
    isListening = false;
    if (activeEngine === 'vosk') voskStop();
    else if (recognition) { try { recognition.stop(); } catch (e) {} }
    activeEngine = null;
    resetMicUI();
    setStatus("Click the microphone to speak a reference…", false);
  }

  // ---- Init --------------------------------------------------------------
  if (webSpeechSupported) setupWebSpeech();

  isContinuousListening = localStorage.getItem('isContinuousListening') === 'true';
  if (continuousCheckbox) {
    continuousCheckbox.checked = isContinuousListening;
    continuousCheckbox.addEventListener('change', () => {
      isContinuousListening = continuousCheckbox.checked;
      localStorage.setItem('isContinuousListening', isContinuousListening);
      if (isContinuousListening) openPresentationTab();
      if (isListening) { stopVoice(); setTimeout(startVoice, 500); }
    });
  }

  micBtn.addEventListener('click', () => {
    if (isListening) stopVoice();
    else startVoice();
  });

  // ==========================================================================
  // LOCALSTORAGE MANAGEMENT: BOOKMARKS & HISTORY LOGS
  // ==========================================================================
  bookmarkBtn.addEventListener('click', toggleBookmark);

  function getBookmarks() {
    return JSON.parse(localStorage.getItem('bible_bookmarks')) || [];
  }

  function getHistory() {
    return JSON.parse(localStorage.getItem('bible_history')) || [];
  }

  function updateBookmarkButtonState() {
    const bookmarks = getBookmarks();
    const currentRefId = getActiveReferenceId();
    const isBookmarked = bookmarks.some(b => b.id === currentRefId);
    
    const svg = bookmarkBtn.querySelector('.bookmark-svg');
    const textSpan = bookmarkBtn.querySelector('.action-btn-text');

    if (isBookmarked) {
      svg.classList.add('active');
      textSpan.textContent = 'Saved';
      bookmarkBtn.style.borderColor = 'var(--gold-primary)';
      bookmarkBtn.style.color = 'var(--gold-primary)';
    } else {
      svg.classList.remove('active');
      textSpan.textContent = 'Save';
      bookmarkBtn.style.borderColor = 'var(--border-color)';
      bookmarkBtn.style.color = 'var(--color-text-primary)';
    }
  }

  function getActiveReferenceId() {
    if (!currentBook) return '';
    return `${currentBook.name}_${currentChapterNum}_${currentVerseStart}_${currentVerseEnd}`;
  }

  function toggleBookmark() {
    if (!currentBook) return;
    
    let bookmarks = getBookmarks();
    const currentRefId = getActiveReferenceId();
    const existingIndex = bookmarks.findIndex(b => b.id === currentRefId);
    
    if (existingIndex > -1) {
      // Remove
      bookmarks.splice(existingIndex, 1);
      showToast("Removed from Saved Verses.");
    } else {
      // Add
      const bookmarkObj = {
        id: currentRefId,
        bookName: currentBook.name,
        chapter: currentChapterNum,
        verseStart: currentVerseStart,
        verseEnd: currentVerseEnd,
        title: scriptureTitle.textContent
      };
      bookmarks.push(bookmarkObj);
      showToast("Saved to Bookmarks!");
    }
    
    localStorage.setItem('bible_bookmarks', JSON.stringify(bookmarks));
    updateBookmarkButtonState();
    renderBookmarks();
  }

  function renderBookmarks() {
    const bookmarks = getBookmarks();
    bookmarksList.innerHTML = '';

    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = '<li class="empty-list-msg">No saved verses yet</li>';
      return;
    }

    bookmarks.forEach(b => {
      const li = document.createElement('li');
      li.textContent = b.title;
      li.onclick = () => {
        const bookObj = BIBLE_DATA.find(x => x.name === b.bookName);
        if (bookObj) {
          renderScripture(bookObj, b.chapter, b.verseStart, b.verseEnd);
        }
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-item-btn';
      delBtn.innerHTML = '&times;';
      delBtn.onclick = (e) => {
        e.stopPropagation(); // Avoid triggering list select click
        deleteBookmark(b.id);
      };

      li.appendChild(delBtn);
      bookmarksList.appendChild(li);
    });
  }

  function deleteBookmark(id) {
    let bookmarks = getBookmarks();
    bookmarks = bookmarks.filter(b => b.id !== id);
    localStorage.setItem('bible_bookmarks', JSON.stringify(bookmarks));
    renderBookmarks();
    updateBookmarkButtonState();
  }

  function saveSearchToHistory(query) {
    let history = getHistory();
    // Exclude duplicates, push to front
    history = history.filter(q => q.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    
    // Limit to 10 entries
    if (history.length > 10) history.pop();
    
    localStorage.setItem('bible_history', JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<li class="empty-list-msg">No recent searches</li>';
      return;
    }

    history.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      li.onclick = () => {
        searchInput.value = q;
        toggleClearBtn();
        parseAndFetchReference(q);
      };
      historyList.appendChild(li);
    });
  }

  clearHistoryBtn.onclick = () => {
    localStorage.removeItem('bible_history');
    renderHistory();
    showToast("Search history cleared.");
  };

  // ==========================================================================
  // HELPER INTERACTION EVENT BINDINGS
  // ==========================================================================
  searchBtn.addEventListener('click', handleManualSearch);
  browseBtn.addEventListener('click', handleBrowseSelection);
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualSearch();
  });

  searchInput.addEventListener('input', toggleClearBtn);

  searchClearBtn.onclick = () => {
    searchInput.value = '';
    toggleClearBtn();
    searchInput.focus();
  };

  function toggleClearBtn() {
    if (searchInput.value.length > 0) {
      searchClearBtn.style.display = 'block';
    } else {
      searchClearBtn.style.display = 'none';
    }
  }

  // Toast UI notification engine
  function showToast(message) {
    // Remove existing toast
    const oldToast = document.querySelector('.toast-msg');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slide-in-toast 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Trigger setup
  initApp();
});
