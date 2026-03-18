const Verification = {
    _selectedPerson: null,  // The TMDB person being claimed
    _selfieFile: null,      // The uploaded selfie file
    _currentStep: 1,        // 1: search, 2: confirm, 3: selfie, 4: submitted

    // Get verification status for current user
    async getStatus() {
        if (!Auth.isSignedIn() || !db) return null;
        try {
            const snap = await db.collection('ss_verifications')
                .where('userId', '==', Auth.getUid())
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();
            if (snap.empty) return null;
            return { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (err) {
            console.error('Failed to get verification status:', err);
            return null;
        }
    },

    // Search for TMDB people (used in step 1)
    async searchPeople(query) {
        if (!query || query.length < 2) return [];
        const results = await API.searchPeople(query);
        return results.results || [];
    },

    // Select a person to claim (step 1 -> step 2)
    selectPerson(person) {
        this._selectedPerson = person;
        this._currentStep = 2;
        this._renderStep();
    },

    // Confirm selection (step 2 -> step 3)
    confirmSelection() {
        this._currentStep = 3;
        this._renderStep();
    },

    // Handle selfie file selection
    handleSelfieUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            Components.toast('Please select an image file', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            Components.toast('Image must be under 10MB', 'error');
            return;
        }
        this._selfieFile = file;
        this._showSelfiePreview(file);
    },

    _showSelfiePreview(file) {
        const preview = document.getElementById('selfie-preview');
        const uploadArea = document.getElementById('selfie-upload-area');
        if (!preview || !uploadArea) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            uploadArea.classList.add('has-preview');
        };
        reader.readAsDataURL(file);

        // Enable submit button
        const submitBtn = document.getElementById('verify-submit-btn');
        if (submitBtn) submitBtn.disabled = false;
    },

    // Submit verification request (step 3 -> step 4)
    async submit() {
        if (!this._selectedPerson || !this._selfieFile) {
            Components.toast('Please complete all steps', 'error');
            return;
        }

        if (!Auth.isSignedIn()) {
            Router.navigate('/login');
            return;
        }

        // Check if this TMDB person is already claimed
        const claimed = await Auth.isProfileClaimed(this._selectedPerson.id);
        if (claimed) {
            Components.toast('This profile has already been claimed by someone else', 'error');
            return;
        }

        const submitBtn = document.getElementById('verify-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            // Upload selfie to Firebase Storage
            const storagePath = `ss_verifications/${Auth.getUid()}/${Date.now()}.jpg`;
            const ref = storage.ref(storagePath);
            await ref.put(this._selfieFile);
            const selfieUrl = await ref.getDownloadURL();

            // Get TMDB profile photo URL
            const tmdbPhotoUrl = this._selectedPerson.profile_path
                ? API.profileUrl(this._selectedPerson.profile_path, 'large')
                : null;

            // Create verification document in Firestore
            await db.collection('ss_verifications').add({
                userId: Auth.getUid(),
                tmdbId: this._selectedPerson.id,
                tmdbName: this._selectedPerson.name,
                tmdbPhotoUrl: tmdbPhotoUrl,
                selfieStoragePath: storagePath,
                selfieUrl: selfieUrl,
                status: 'pending',
                confidenceScore: null,
                reviewedBy: null,
                reviewedAt: null,
                rejectionReason: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update user's verification status
            await db.collection('ss_users').doc(Auth.getUid()).update({
                verificationStatus: 'pending'
            });

            this._currentStep = 4;
            this._renderStep();
            Components.toast('Verification submitted! We\'ll review it shortly.', 'success');

        } catch (err) {
            console.error('Verification submission failed:', err);
            Components.toast('Submission failed: ' + err.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit for Verification';
            }
        }
    },

    // Render the current step (called by Pages.verify and after step transitions)
    _renderStep() {
        const container = document.getElementById('verify-content');
        if (!container) return;

        switch (this._currentStep) {
            case 1:
                container.innerHTML = this._renderSearchStep();
                this._initSearchStep();
                break;
            case 2:
                container.innerHTML = this._renderConfirmStep();
                break;
            case 3:
                container.innerHTML = this._renderSelfieStep();
                this._initSelfieStep();
                break;
            case 4:
                container.innerHTML = this._renderSubmittedStep();
                break;
        }
    },

    _renderSearchStep() {
        return `
            <div class="verify-step-content">
                <h2 class="verify-step-title">Find Your Profile</h2>
                <p class="text-secondary">Search for yourself in our database of film & television professionals.</p>
                <div class="verify-search">
                    <input type="text" id="verify-search-input" class="form-input"
                        placeholder="Search by name..." autocomplete="off">
                </div>
                <div id="verify-search-results" class="verify-results"></div>
            </div>
        `;
    },

    _initSearchStep() {
        const input = document.getElementById('verify-search-input');
        if (!input) return;

        let debounce;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(async () => {
                const query = input.value.trim();
                const resultsEl = document.getElementById('verify-search-results');
                if (!resultsEl) return;

                if (query.length < 2) {
                    resultsEl.innerHTML = '';
                    return;
                }

                resultsEl.innerHTML = '<div class="spinner" style="margin:2rem auto"></div>';
                const people = await this.searchPeople(query);

                if (people.length === 0) {
                    resultsEl.innerHTML = '<p class="text-secondary text-center" style="padding:2rem">No results found. Make sure your name appears on TMDB/Fresh Kernels.</p>';
                    return;
                }

                resultsEl.innerHTML = people.slice(0, 10).map(p => `
                    <div class="verify-result-item" data-person-id="${p.id}" data-person='${JSON.stringify(p).replace(/'/g, "&#39;")}'>
                        <div class="verify-result-photo">
                            ${p.profile_path
                                ? `<img src="${API.profileUrl(p.profile_path, 'medium')}" alt="${p.name}">`
                                : `<div class="person-card-photo-placeholder">${p.name.charAt(0)}</div>`
                            }
                        </div>
                        <div class="verify-result-info">
                            <div class="verify-result-name">${p.name}</div>
                            <div class="verify-result-dept">${p.known_for_department || 'Film Professional'}</div>
                            ${p.known_for?.length ? `<div class="verify-result-known">Known for: ${p.known_for.slice(0,2).map(k => k.title || k.name).join(', ')}</div>` : ''}
                        </div>
                    </div>
                `).join('');

                // Add click handlers
                resultsEl.querySelectorAll('.verify-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const person = JSON.parse(item.dataset.person);
                        this.selectPerson(person);
                    });
                });
            }, 300);
        });

        input.focus();
    },

    _renderConfirmStep() {
        const p = this._selectedPerson;
        if (!p) return '';

        return `
            <div class="verify-step-content">
                <h2 class="verify-step-title">Confirm Your Identity</h2>
                <p class="text-secondary">Is this you?</p>
                <div class="verify-confirm-card">
                    <div class="verify-confirm-photo">
                        ${p.profile_path
                            ? `<img src="${API.profileUrl(p.profile_path, 'large')}" alt="${p.name}">`
                            : `<div class="person-card-photo-placeholder" style="width:150px;height:150px;font-size:3rem">${p.name.charAt(0)}</div>`
                        }
                    </div>
                    <h3 class="verify-confirm-name">${p.name}</h3>
                    <p class="verify-confirm-dept">${p.known_for_department || 'Film Professional'}</p>
                    ${p.known_for?.length ? `<p class="text-secondary" style="font-size:0.9rem">Known for: ${p.known_for.slice(0,3).map(k => k.title || k.name).join(', ')}</p>` : ''}
                    <div class="verify-confirm-actions">
                        <button class="btn btn-secondary" onclick="Verification._currentStep = 1; Verification._renderStep();">Not Me</button>
                        <button class="btn btn-primary" onclick="Verification.confirmSelection()">Yes, This Is Me</button>
                    </div>
                </div>
            </div>
        `;
    },

    _renderSelfieStep() {
        return `
            <div class="verify-step-content">
                <h2 class="verify-step-title">Verify Your Identity</h2>
                <p class="text-secondary">Upload a clear photo of yourself. We'll compare it to your profile photo to confirm your identity.</p>
                <div id="selfie-upload-area" class="verify-selfie-area">
                    <input type="file" id="selfie-input" accept="image/*" capture="user" style="display:none">
                    <img id="selfie-preview" style="display:none" class="verify-selfie-preview" alt="Your photo">
                    <div class="verify-selfie-prompt" id="selfie-prompt">
                        <div style="font-size:3rem;margin-bottom:1rem">📸</div>
                        <p>Tap to take or upload a photo</p>
                        <p class="text-tertiary" style="font-size:0.85rem">Clear, well-lit photo of your face</p>
                    </div>
                </div>
                <button id="verify-submit-btn" class="btn btn-primary btn-full" disabled onclick="Verification.submit()">
                    Submit for Verification
                </button>
                <p class="text-tertiary text-center" style="margin-top:1rem;font-size:0.85rem">
                    Your photo will be securely stored and only used for identity verification.
                </p>
            </div>
        `;
    },

    _initSelfieStep() {
        const area = document.getElementById('selfie-upload-area');
        const input = document.getElementById('selfie-input');
        if (!area || !input) return;

        area.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files?.[0]) {
                this.handleSelfieUpload(e.target.files[0]);
                // Hide prompt
                const prompt = document.getElementById('selfie-prompt');
                if (prompt) prompt.style.display = 'none';
            }
        });
    },

    _renderSubmittedStep() {
        return `
            <div class="verify-step-content text-center">
                <div style="font-size:4rem;margin-bottom:1rem">✅</div>
                <h2 class="verify-step-title">Verification Submitted</h2>
                <p class="text-secondary" style="max-width:400px;margin:1rem auto">
                    Your verification request is being reviewed. This typically takes less than 24 hours.
                    We'll notify you once your identity has been confirmed.
                </p>
                <a href="/" class="btn btn-secondary" style="margin-top:2rem">Back to Home</a>
            </div>
        `;
    },

    // Reset state
    reset() {
        this._selectedPerson = null;
        this._selfieFile = null;
        this._currentStep = 1;
    },

    // Admin: approve a verification
    async approveVerification(verificationId) {
        if (!Auth.isAdmin() || !db) return;

        try {
            const doc = await db.collection('ss_verifications').doc(verificationId).get();
            if (!doc.exists) return;
            const data = doc.data();

            // Update verification status
            await db.collection('ss_verifications').doc(verificationId).update({
                status: 'approved',
                reviewedBy: Auth.getUid(),
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update user profile
            await db.collection('ss_users').doc(data.userId).update({
                verified: true,
                verificationStatus: 'approved',
                tmdbId: data.tmdbId
            });

            // Create or update the ss_profiles document
            const profileRef = db.collection('ss_profiles').doc(String(data.tmdbId));
            const profileDoc = await profileRef.get();

            if (profileDoc.exists) {
                await profileRef.update({
                    claimedBy: data.userId,
                    claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    verified: true
                });
            } else {
                // Fetch TMDB data to populate profile
                try {
                    const tmdbData = await API.getPersonDetails(data.tmdbId);
                    await profileRef.set({
                        tmdbId: data.tmdbId,
                        name: tmdbData.name,
                        knownForDepartment: tmdbData.known_for_department,
                        profilePath: tmdbData.profile_path,
                        biography: tmdbData.biography,
                        birthday: tmdbData.birthday,
                        placeOfBirth: tmdbData.place_of_birth,
                        externalIds: tmdbData.external_ids || {},
                        claimedBy: data.userId,
                        claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        verified: true,
                        customBio: null,
                        customPhotoUrl: null,
                        postCount: 0,
                        lastTmdbSync: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (e) {
                    await profileRef.set({
                        tmdbId: data.tmdbId,
                        name: data.tmdbName,
                        claimedBy: data.userId,
                        claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        verified: true,
                        customBio: null,
                        customPhotoUrl: null,
                        postCount: 0
                    });
                }
            }

            Components.toast(`Verified ${data.tmdbName}`, 'success');
        } catch (err) {
            console.error('Approval failed:', err);
            Components.toast('Approval failed: ' + err.message, 'error');
        }
    },

    // Admin: reject a verification
    async rejectVerification(verificationId, reason = '') {
        if (!Auth.isAdmin() || !db) return;

        try {
            const doc = await db.collection('ss_verifications').doc(verificationId).get();
            if (!doc.exists) return;
            const data = doc.data();

            await db.collection('ss_verifications').doc(verificationId).update({
                status: 'rejected',
                rejectionReason: reason || 'Could not verify identity',
                reviewedBy: Auth.getUid(),
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('ss_users').doc(data.userId).update({
                verificationStatus: 'rejected'
            });

            Components.toast(`Rejected verification for ${data.tmdbName}`, 'info');
        } catch (err) {
            console.error('Rejection failed:', err);
            Components.toast('Rejection failed: ' + err.message, 'error');
        }
    }
};
