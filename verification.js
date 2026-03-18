const Verification = {
    _selectedPerson: null,  // The TMDB person being claimed
    _selfieFile: null,      // The uploaded selfie file
    _currentStep: 1,        // 1: search, 2: confirm, 3: selfie, 4: submitted
    _challengePose: null,   // The randomly selected verification pose

    // Verification poses — random challenge to prevent using stock/AI photos
    _poses: [
        { id: 'peace', emoji: '✌️', label: 'Peace Sign', instruction: 'Hold up a peace sign next to your face' },
        { id: 'thumbsup', emoji: '👍', label: 'Thumbs Up', instruction: 'Give a thumbs up next to your face' },
        { id: 'ok', emoji: '👌', label: 'OK Sign', instruction: 'Make an OK sign next to your face' },
        { id: 'wave', emoji: '👋', label: 'Wave', instruction: 'Wave at the camera with your hand visible' },
        { id: 'three', emoji: '🤟', label: 'Three Fingers', instruction: 'Hold up three fingers next to your face' },
        { id: 'point', emoji: '👆', label: 'Point Up', instruction: 'Point upward with one finger next to your face' },
    ],

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
        // Pick a random challenge pose
        this._challengePose = this._poses[Math.floor(Math.random() * this._poses.length)];
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

        // Show retake button and enable submit
        const retakeBtn = document.getElementById('selfie-retake-btn');
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';
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
            submitBtn.innerHTML = '<span class="spinner-small"></span> Analyzing & submitting...';
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
                challengePose: this._challengePose?.id || 'unknown',
                challengeLabel: this._challengePose?.label || 'Unknown',
                status: 'pending',
                aiAnalysis: null,        // Will be populated by Cloud Function
                faceMatchScore: null,    // Will be populated by Cloud Function
                aiGeneratedScore: null,  // Will be populated by Cloud Function
                poseDetected: null,      // Will be populated by Cloud Function
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
        const pose = this._challengePose;
        const p = this._selectedPerson;

        return `
            <div class="verify-step-content">
                <h2 class="verify-step-title">Prove It's Really You</h2>
                <p class="text-secondary">To confirm you're really <strong>${p?.name || 'who you say you are'}</strong>, we need a live photo — not a screenshot, not AI-generated, and not someone else's picture.</p>

                <div class="verify-challenge">
                    <div class="verify-challenge-icon">${pose?.emoji || '📸'}</div>
                    <div class="verify-challenge-text">
                        <h3>Your challenge: <span class="verify-challenge-pose">${pose?.label || 'Selfie'}</span></h3>
                        <p>${pose?.instruction || 'Take a clear photo of yourself'}</p>
                    </div>
                </div>

                <div class="verify-requirements">
                    <div class="verify-requirement">
                        <span class="verify-req-icon">📱</span>
                        <span>Take a <strong>new photo right now</strong> — no old photos</span>
                    </div>
                    <div class="verify-requirement">
                        <span class="verify-req-icon">${pose?.emoji || '✌️'}</span>
                        <span><strong>${pose?.label || 'Pose'}</strong> must be clearly visible</span>
                    </div>
                    <div class="verify-requirement">
                        <span class="verify-req-icon">💡</span>
                        <span>Good lighting, face clearly visible</span>
                    </div>
                    <div class="verify-requirement">
                        <span class="verify-req-icon">🤖</span>
                        <span>AI-generated images will be <strong>automatically rejected</strong></span>
                    </div>
                </div>

                ${p?.profile_path ? `
                <div class="verify-reference">
                    <img src="${API.profileUrl(p.profile_path, 'medium')}" alt="${p?.name}" class="verify-reference-photo">
                    <div class="verify-reference-text">
                        <p class="text-secondary" style="font-size:0.8rem">We'll match your photo against this profile image</p>
                    </div>
                </div>
                ` : ''}

                <div class="verify-capture-actions">
                    <button class="btn btn-primary btn-lg" onclick="Verification._openCamera()" id="camera-btn">
                        📸 Take Photo with Camera
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('selfie-input').click()">
                        📁 Upload a Photo You Just Took
                    </button>
                    <input type="file" id="selfie-input" accept="image/*" style="display:none">
                </div>

                <div id="selfie-upload-area" class="verify-selfie-area" style="display:none">
                    <img id="selfie-preview" style="display:none" class="verify-selfie-preview" alt="Your photo">
                </div>

                <div id="selfie-actions" style="display:none">
                    <button id="selfie-retake-btn" class="btn btn-secondary" onclick="Verification._retake()" style="display:none">
                        🔄 Retake Photo
                    </button>
                    <button id="verify-submit-btn" class="btn btn-primary btn-full" disabled onclick="Verification.submit()">
                        Submit for Verification
                    </button>
                </div>

                <p class="text-tertiary text-center" style="margin-top:1rem;font-size:0.8rem">
                    Your photo is stored securely and only used for identity verification.
                    Our system checks for AI-generated images, verifies the pose challenge,
                    and compares your face against your known profile photo.
                </p>
            </div>
        `;
    },

    _openCamera() {
        // Create a hidden file input with capture="user" to force camera
        const cameraInput = document.createElement('input');
        cameraInput.type = 'file';
        cameraInput.accept = 'image/*';
        cameraInput.capture = 'user';
        cameraInput.style.display = 'none';
        document.body.appendChild(cameraInput);

        cameraInput.addEventListener('change', (e) => {
            if (e.target.files?.[0]) {
                this.handleSelfieUpload(e.target.files[0]);
                this._showCapturedPhoto();
            }
            document.body.removeChild(cameraInput);
        });

        cameraInput.click();
    },

    _showCapturedPhoto() {
        // Show the preview area and action buttons
        const area = document.getElementById('selfie-upload-area');
        const actions = document.getElementById('selfie-actions');
        const captureActions = document.querySelector('.verify-capture-actions');
        if (area) area.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        if (captureActions) captureActions.style.display = 'none';

        // Show retake button
        const retakeBtn = document.getElementById('selfie-retake-btn');
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';
    },

    _retake() {
        this._selfieFile = null;
        const preview = document.getElementById('selfie-preview');
        const area = document.getElementById('selfie-upload-area');
        const actions = document.getElementById('selfie-actions');
        const captureActions = document.querySelector('.verify-capture-actions');
        const submitBtn = document.getElementById('verify-submit-btn');

        if (preview) { preview.style.display = 'none'; preview.src = ''; }
        if (area) { area.style.display = 'none'; area.classList.remove('has-preview'); }
        if (actions) actions.style.display = 'none';
        if (captureActions) captureActions.style.display = 'flex';
        if (submitBtn) submitBtn.disabled = true;
    },

    _initSelfieStep() {
        const input = document.getElementById('selfie-input');
        if (!input) return;

        input.addEventListener('change', (e) => {
            if (e.target.files?.[0]) {
                this.handleSelfieUpload(e.target.files[0]);
                this._showCapturedPhoto();
            }
        });
    },

    _renderSubmittedStep() {
        return `
            <div class="verify-step-content text-center">
                <div style="font-size:4rem;margin-bottom:1rem">✅</div>
                <h2 class="verify-step-title">Verification Submitted</h2>
                <p class="text-secondary" style="max-width:400px;margin:1rem auto">
                    Your photo is being analyzed for authenticity and compared to your profile.
                    This typically takes less than 24 hours. We'll notify you once your identity has been confirmed.
                </p>
                <div class="verify-checks-summary">
                    <div class="verify-check-item">
                        <span>🔍</span> Face comparison against profile photo
                    </div>
                    <div class="verify-check-item">
                        <span>${this._challengePose?.emoji || '✌️'}</span> ${this._challengePose?.label || 'Pose'} challenge verification
                    </div>
                    <div class="verify-check-item">
                        <span>🤖</span> AI-generated image detection
                    </div>
                </div>
                <a href="/" class="btn btn-secondary" style="margin-top:1.5rem">Back to Home</a>
            </div>
        `;
    },

    // Reset state
    reset() {
        this._selectedPerson = null;
        this._selfieFile = null;
        this._currentStep = 1;
        this._challengePose = null;
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
