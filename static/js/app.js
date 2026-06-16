document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let allUpdates = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdate = null;
    let activeTemplate = 'announcement';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const lastFetchedTime = document.getElementById('last-fetched-time');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const typeFilters = document.getElementById('type-filters');
    const updatesGrid = document.getElementById('updates-grid');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const emptyState = document.getElementById('empty-state');
    
    // Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const submitTweetBtn = document.getElementById('submit-tweet-btn');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const previewCardTitle = document.getElementById('preview-card-title');
    const charCounter = document.getElementById('char-counter');
    
    // Template Chips
    const tplAnnouncement = document.getElementById('tpl-announcement');
    const tplStandard = document.getElementById('tpl-standard');
    const tplMinimal = document.getElementById('tpl-minimal');

    // Fetch release notes on load
    fetchUpdates(false);

    // Refresh button event listener
    refreshBtn.addEventListener('click', () => {
        fetchUpdates(true);
    });

    // Retry button event listener
    retryBtn.addEventListener('click', () => {
        fetchUpdates(true);
    });

    // Search input event listener
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        filterAndRender();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        filterAndRender();
    });

    // Filter tags event listener
    typeFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tag')) {
            // Remove active class from all filters
            document.querySelectorAll('.filter-tag').forEach(tag => {
                tag.classList.remove('active');
            });
            // Add active class to clicked filter
            e.target.classList.add('active');
            activeFilter = e.target.dataset.type;
            filterAndRender();
        }
    });

    // Fetch updates from API
    async function fetchUpdates(forceRefresh = false) {
        setLoading(true);
        let url = '/api/updates';
        if (forceRefresh) {
            url += '?refresh=true';
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                allUpdates = data.updates;
                lastFetchedTime.textContent = data.last_fetched || 'Just now';
                setError(false);
                filterAndRender();
            } else {
                throw new Error(data.error || 'Server returned an error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            errorMessage.textContent = error.message || 'Failed to connect to the server.';
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    // Toggle Loading State
    function setLoading(isLoading) {
        if (isLoading) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
            loadingState.style.display = 'flex';
            updatesGrid.style.display = 'none';
            errorState.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
            loadingState.style.display = 'none';
        }
    }

    // Toggle Error State
    function setError(isError) {
        if (isError) {
            errorState.style.display = 'flex';
            updatesGrid.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            errorState.style.display = 'none';
        }
    }

    // Filter and Render updates
    function filterAndRender() {
        if (errorState.style.display === 'flex') return;

        // Apply type and search filters
        const filtered = allUpdates.filter(update => {
            const matchesType = activeFilter === 'all' || update.type === activeFilter;
            const matchesSearch = !searchQuery || 
                update.type.toLowerCase().includes(searchQuery) ||
                update.date.toLowerCase().includes(searchQuery) ||
                update.text.toLowerCase().includes(searchQuery);
            return matchesType && matchesSearch;
        });

        if (filtered.length === 0) {
            emptyState.style.display = 'flex';
            updatesGrid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            updatesGrid.style.display = 'grid';
            renderCards(filtered);
        }
    }

    // Render release cards
    function renderCards(updates) {
        updatesGrid.innerHTML = '';
        
        updates.forEach(update => {
            const card = document.createElement('div');
            card.className = 'release-card';
            card.id = update.id;
            
            // Map types to lowercase for class styling
            const typeClass = `type-${update.type.toLowerCase()}`;
            
            card.innerHTML = `
                <div>
                    <div class="card-header">
                        <span class="type-badge ${typeClass}">${update.type}</span>
                        <span class="date-badge">${update.date}</span>
                    </div>
                    <div class="card-content">
                        ${update.html}
                    </div>
                </div>
                <div class="card-actions">
                    ${update.link ? `
                        <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="source-link">
                            <span>View docs</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    ` : '<span></span>'}
                    <button class="btn btn-twitter btn-card-tweet" data-id="${update.id}">
                        <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            updatesGrid.appendChild(card);
        });

        // Add event listeners to Tweet buttons
        document.querySelectorAll('.btn-card-tweet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const updateId = e.currentTarget.dataset.id;
                const updateObj = allUpdates.find(u => u.id === updateId);
                if (updateObj) {
                    openTweetModal(updateObj);
                }
            });
        });
    }

    // Modal Logic
    function openTweetModal(update) {
        selectedUpdate = update;
        activeTemplate = 'announcement';
        
        // Reset Template Active State
        resetTemplateChips();
        tplAnnouncement.classList.add('active');

        // Set Preview Title
        previewCardTitle.textContent = `BigQuery Release Notes (${update.date})`;

        // Populate and generate tweet text
        generateTweetText();
        
        // Open Modal
        tweetModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scroll
        
        // Focus textarea
        setTimeout(() => {
            tweetTextarea.focus();
            tweetTextarea.setSelectionRange(0, 0); // Position cursor at start
        }, 100);
    }

    function closeTweetModal() {
        tweetModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Unlock scroll
        selectedUpdate = null;
    }

    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    
    // Close modal if clicked outside card
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Character Counter with Twitter t.co Logic
    // Twitter shortens all URLs to a fixed 23 characters
    function calculateTwitterLength(text) {
        // Regex to match URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        let length = text.length;
        
        const urls = text.match(urlRegex);
        if (urls) {
            urls.forEach(url => {
                // Subtract the actual URL length and add 23
                length = length - url.length + 23;
            });
        }
        return length;
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = calculateTwitterLength(text);
        charCounter.textContent = `${count} / 280`;

        charCounter.className = 'char-counter';
        if (count > 250 && count <= 280) {
            charCounter.classList.add('warning');
            submitTweetBtn.disabled = false;
        } else if (count > 280) {
            charCounter.classList.add('error');
            submitTweetBtn.disabled = true;
        } else {
            submitTweetBtn.disabled = false;
        }
    }

    tweetTextarea.addEventListener('input', updateCharCount);

    // Template Selector Events
    tplAnnouncement.addEventListener('click', () => {
        activeTemplate = 'announcement';
        resetTemplateChips();
        tplAnnouncement.classList.add('active');
        generateTweetText();
    });

    tplStandard.addEventListener('click', () => {
        activeTemplate = 'standard';
        resetTemplateChips();
        tplStandard.classList.add('active');
        generateTweetText();
    });

    tplMinimal.addEventListener('click', () => {
        activeTemplate = 'minimal';
        resetTemplateChips();
        tplMinimal.classList.add('active');
        generateTweetText();
    });

    function resetTemplateChips() {
        [tplAnnouncement, tplStandard, tplMinimal].forEach(chip => {
            chip.classList.remove('active');
        });
    }

    // Tweet Text Generation & Truncation Helper
    function generateTweetText() {
        if (!selectedUpdate) return;
        
        const date = selectedUpdate.date;
        const type = selectedUpdate.type;
        const text = selectedUpdate.text;
        const link = selectedUpdate.link;

        let tweetText = '';
        
        // We define template structures:
        // Prefix + CoreText + Suffix
        let prefix = '';
        let suffix = '';

        if (activeTemplate === 'announcement') {
            prefix = `🚀 BigQuery Update [${type}] (${date}): `;
            suffix = `\n\nLink: ${link}\n#BigQuery #GoogleCloud`;
        } else if (activeTemplate === 'standard') {
            prefix = `Google Cloud BigQuery [${type}]: `;
            suffix = `\n\nRead more: ${link}\n#GCP`;
        } else { // minimal
            prefix = ``;
            suffix = `\n\n${link} #BigQuery`;
        }

        // Calculate maximum allowed characters for the core text
        // URL within suffix is counted as 23 characters
        const dummySuffix = suffix.replace(/https?:\/\/[^\s]+/g, "x".repeat(23));
        const nonTextLen = prefix.length + dummySuffix.length;
        const maxTextLen = 280 - nonTextLen;

        let coreText = text;
        if (text.length > maxTextLen) {
            // Truncate text to fit
            coreText = text.substring(0, maxTextLen - 3) + '...';
        }

        tweetText = prefix + coreText + suffix;
        tweetTextarea.value = tweetText;
        updateCharCount();
    }

    // Submit Tweet (Open Web Intent)
    submitTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
    });
});
