const Posts = {
    _feedPosts: [],
    _feedLoading: false,
    _feedLastDoc: null,
    _feedHasMore: true,

    // Firestore collections:
    // ss_posts/{postId} - posts
    //   Fields: { authorId, authorTmdbId, authorName, authorPhotoUrl, authorVerified: true, text, imageUrl, imageStoragePath, likeCount, commentCount, createdAt, updatedAt, reported, hidden }
    // ss_posts/{postId}/likes/{uid} - likes (doc ID = user UID)
    //   Fields: { userId, createdAt }
    // ss_posts/{postId}/comments/{commentId} - comments
    //   Fields: { authorId, authorTmdbId, authorName, authorPhotoUrl, text, createdAt, reported }

    // Create a new post
    async createPost(text, imageFile = null) {
        if (!Auth.isVerified() || !db) {
            Components.toast('You must be verified to post', 'error');
            return null;
        }

        text = text.trim();
        if (!text || text.length > 1000) {
            Components.toast('Post must be between 1 and 1000 characters', 'error');
            return null;
        }

        const profile = Auth.getProfile();
        let imageUrl = null;
        let imageStoragePath = null;

        // Upload image if provided
        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) {
                Components.toast('Image must be under 5MB', 'error');
                return null;
            }
            try {
                imageStoragePath = `ss_posts/${Auth.getUid()}/${Date.now()}_${imageFile.name}`;
                const ref = storage.ref(imageStoragePath);
                await ref.put(imageFile);
                imageUrl = await ref.getDownloadURL();
            } catch (err) {
                console.error('Image upload failed:', err);
                Components.toast('Image upload failed', 'error');
                return null;
            }
        }

        try {
            const postData = {
                authorId: Auth.getUid(),
                authorTmdbId: profile.tmdbId,
                authorName: profile.displayName,
                authorPhotoUrl: profile.customPhotoUrl || profile.photoURL || '',
                authorVerified: true,
                text: text,
                imageUrl: imageUrl,
                imageStoragePath: imageStoragePath,
                likeCount: 0,
                commentCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: null,
                reported: false,
                hidden: false
            };

            const docRef = await db.collection('ss_posts').add(postData);

            // Increment post count on profile
            if (profile.tmdbId) {
                db.collection('ss_profiles').doc(String(profile.tmdbId)).update({
                    postCount: firebase.firestore.FieldValue.increment(1)
                }).catch(() => {});
            }

            Components.toast('Posted!', 'success');
            return docRef.id;
        } catch (err) {
            console.error('Create post failed:', err);
            Components.toast('Failed to create post: ' + err.message, 'error');
            return null;
        }
    },

    // Load feed posts (paginated)
    async loadFeed(reset = false) {
        if (!db || this._feedLoading) return [];

        if (reset) {
            this._feedPosts = [];
            this._feedLastDoc = null;
            this._feedHasMore = true;
        }

        if (!this._feedHasMore) return this._feedPosts;

        this._feedLoading = true;

        try {
            let query = db.collection('ss_posts')
                .where('hidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(20);

            if (this._feedLastDoc) {
                query = query.startAfter(this._feedLastDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                this._feedHasMore = false;
            } else {
                this._feedLastDoc = snapshot.docs[snapshot.docs.length - 1];
                if (snapshot.docs.length < 20) this._feedHasMore = false;

                const newPosts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Check likes for current user
                if (Auth.isVerified()) {
                    for (const post of newPosts) {
                        try {
                            const likeDoc = await db.collection('ss_posts').doc(post.id)
                                .collection('likes').doc(Auth.getUid()).get();
                            post.liked = likeDoc.exists;
                        } catch (e) {
                            post.liked = false;
                        }
                    }
                }

                this._feedPosts = [...this._feedPosts, ...newPosts];
            }
        } catch (err) {
            console.error('Load feed failed:', err);
        }

        this._feedLoading = false;
        return this._feedPosts;
    },

    // Load posts by a specific person (by their TMDB ID)
    async loadPersonPosts(tmdbId, limit = 20) {
        if (!db) return [];

        try {
            const snapshot = await db.collection('ss_posts')
                .where('authorTmdbId', '==', Number(tmdbId))
                .where('hidden', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Check likes for current user
            if (Auth.isVerified()) {
                for (const post of posts) {
                    try {
                        const likeDoc = await db.collection('ss_posts').doc(post.id)
                            .collection('likes').doc(Auth.getUid()).get();
                        post.liked = likeDoc.exists;
                    } catch (e) {
                        post.liked = false;
                    }
                }
            }

            return posts;
        } catch (err) {
            console.error('Load person posts failed:', err);
            return [];
        }
    },

    // Get a single post with comments
    async getPost(postId) {
        if (!db) return null;

        try {
            const doc = await db.collection('ss_posts').doc(postId).get();
            if (!doc.exists) return null;

            const post = { id: doc.id, ...doc.data() };

            // Check if current user liked it
            if (Auth.isVerified()) {
                try {
                    const likeDoc = await db.collection('ss_posts').doc(postId)
                        .collection('likes').doc(Auth.getUid()).get();
                    post.liked = likeDoc.exists;
                } catch (e) {
                    post.liked = false;
                }
            }

            // Load comments
            const commentsSnap = await db.collection('ss_posts').doc(postId)
                .collection('comments')
                .orderBy('createdAt', 'asc')
                .limit(100)
                .get();

            post.comments = commentsSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            return post;
        } catch (err) {
            console.error('Get post failed:', err);
            return null;
        }
    },

    // Toggle like on a post
    async toggleLike(postId) {
        if (!Auth.isVerified() || !db) {
            Components.toast('You must be verified to like posts', 'error');
            return;
        }

        const uid = Auth.getUid();
        const likeRef = db.collection('ss_posts').doc(postId).collection('likes').doc(uid);
        const postRef = db.collection('ss_posts').doc(postId);

        try {
            const likeDoc = await likeRef.get();

            if (likeDoc.exists) {
                // Unlike
                const batch = db.batch();
                batch.delete(likeRef);
                batch.update(postRef, { likeCount: firebase.firestore.FieldValue.increment(-1) });
                await batch.commit();
                return false; // unliked
            } else {
                // Like
                const batch = db.batch();
                batch.set(likeRef, {
                    userId: uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                batch.update(postRef, { likeCount: firebase.firestore.FieldValue.increment(1) });
                await batch.commit();
                return true; // liked
            }
        } catch (err) {
            console.error('Toggle like failed:', err);
            Components.toast('Failed to update like', 'error');
        }
    },

    // Add a comment to a post
    async addComment(postId, text) {
        if (!Auth.isVerified() || !db) {
            Components.toast('You must be verified to comment', 'error');
            return null;
        }

        text = text.trim();
        if (!text || text.length > 500) {
            Components.toast('Comment must be between 1 and 500 characters', 'error');
            return null;
        }

        const profile = Auth.getProfile();

        try {
            const batch = db.batch();

            const commentRef = db.collection('ss_posts').doc(postId).collection('comments').doc();
            batch.set(commentRef, {
                authorId: Auth.getUid(),
                authorTmdbId: profile.tmdbId,
                authorName: profile.displayName,
                authorPhotoUrl: profile.customPhotoUrl || profile.photoURL || '',
                text: text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                reported: false
            });

            // Increment comment count
            batch.update(db.collection('ss_posts').doc(postId), {
                commentCount: firebase.firestore.FieldValue.increment(1)
            });

            await batch.commit();
            Components.toast('Comment added', 'success');
            return commentRef.id;
        } catch (err) {
            console.error('Add comment failed:', err);
            Components.toast('Failed to add comment', 'error');
            return null;
        }
    },

    // Delete a post (own posts only, or admin)
    async deletePost(postId) {
        if (!Auth.isSignedIn() || !db) return;

        try {
            const doc = await db.collection('ss_posts').doc(postId).get();
            if (!doc.exists) return;

            const post = doc.data();
            if (post.authorId !== Auth.getUid() && !Auth.isAdmin()) {
                Components.toast('You can only delete your own posts', 'error');
                return;
            }

            await db.collection('ss_posts').doc(postId).delete();

            // Delete image from storage if exists
            if (post.imageStoragePath) {
                storage.ref(post.imageStoragePath).delete().catch(() => {});
            }

            // Decrement post count on profile
            if (post.authorTmdbId) {
                db.collection('ss_profiles').doc(String(post.authorTmdbId)).update({
                    postCount: firebase.firestore.FieldValue.increment(-1)
                }).catch(() => {});
            }

            Components.toast('Post deleted', 'info');
        } catch (err) {
            console.error('Delete post failed:', err);
            Components.toast('Failed to delete post', 'error');
        }
    },

    // Report a post
    async reportPost(postId, reason) {
        if (!Auth.isSignedIn() || !db) return;

        try {
            await db.collection('ss_reports').add({
                reporterId: Auth.getUid(),
                targetType: 'post',
                targetId: postId,
                reason: reason,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                resolvedBy: null,
                resolvedAt: null
            });

            // Flag the post
            await db.collection('ss_posts').doc(postId).update({ reported: true });

            Components.toast('Report submitted', 'info');
        } catch (err) {
            Components.toast('Failed to submit report', 'error');
        }
    },

    // Initialize post composer event handlers
    initComposer() {
        const textarea = document.getElementById('post-composer-text');
        const counter = document.getElementById('post-char-count');
        const submitBtn = document.getElementById('post-submit-btn');
        const imageInput = document.getElementById('post-image-input');
        const imageBtn = document.getElementById('post-image-btn');

        if (!textarea || !submitBtn) return;

        let selectedImage = null;

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            if (counter) counter.textContent = `${len}/1000`;
            submitBtn.disabled = len === 0 || len > 1000;

            // Auto-resize textarea
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });

        if (imageBtn && imageInput) {
            imageBtn.addEventListener('click', () => imageInput.click());
            imageInput.addEventListener('change', (e) => {
                selectedImage = e.target.files?.[0] || null;
                if (selectedImage) {
                    imageBtn.classList.add('active');
                    imageBtn.title = selectedImage.name;
                }
            });
        }

        submitBtn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (!text) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';

            const postId = await this.createPost(text, selectedImage);

            if (postId) {
                textarea.value = '';
                if (counter) counter.textContent = '0/1000';
                selectedImage = null;
                if (imageBtn) imageBtn.classList.remove('active');
                textarea.style.height = 'auto';

                // Reload feed
                if (Router.current.route === 'feed') {
                    const posts = await this.loadFeed(true);
                    const feedEl = document.getElementById('feed-posts');
                    if (feedEl) {
                        feedEl.innerHTML = posts.map(p => Components.postCard(p)).join('');
                    }
                }
            }

            submitBtn.disabled = false;
            submitBtn.textContent = 'Post';
        });
    },

    // Initialize infinite scroll for feed
    initInfiniteScroll() {
        const sentinel = document.getElementById('feed-sentinel');
        if (!sentinel) return;

        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && this._feedHasMore && !this._feedLoading) {
                const posts = await this.loadFeed();
                const feedEl = document.getElementById('feed-posts');
                if (feedEl) {
                    feedEl.innerHTML = posts.map(p => Components.postCard(p)).join('');
                }
                if (!this._feedHasMore) {
                    sentinel.style.display = 'none';
                }
            }
        });

        observer.observe(sentinel);
    }
};

// Document-level click handler for like buttons, comment submission, and post deletion
document.addEventListener('click', async (e) => {
    // Like button
    const likeBtn = e.target.closest('[data-action="like"]');
    if (likeBtn) {
        e.preventDefault();
        const postId = likeBtn.dataset.postId;
        if (!postId) return;

        const liked = await Posts.toggleLike(postId);
        if (liked !== undefined) {
            // Update UI
            const icon = likeBtn.querySelector('.like-icon');
            const count = likeBtn.querySelector('.like-count');
            if (liked) {
                likeBtn.classList.add('liked');
                if (icon) icon.innerHTML = Components._icons.heartFilled;
                if (count) count.textContent = Number(count.textContent) + 1;
            } else {
                likeBtn.classList.remove('liked');
                if (icon) icon.innerHTML = Components._icons.heart;
                if (count) count.textContent = Math.max(0, Number(count.textContent) - 1);
            }
        }
    }

    // Comment submit
    const commentBtn = e.target.closest('[data-action="submit-comment"]');
    if (commentBtn) {
        e.preventDefault();
        const postId = commentBtn.dataset.postId;
        const input = document.getElementById(`comment-input-${postId}`);
        if (!postId || !input) return;

        const text = input.value.trim();
        if (!text) return;

        commentBtn.disabled = true;
        const commentId = await Posts.addComment(postId, text);
        commentBtn.disabled = false;

        if (commentId) {
            input.value = '';
            // Reload post detail if we're on it
            if (Router.current.route === 'postDetail') {
                Router.handleRoute();
            }
        }
    }

    // Delete post
    const deleteBtn = e.target.closest('[data-action="delete-post"]');
    if (deleteBtn) {
        e.preventDefault();
        const postId = deleteBtn.dataset.postId;
        if (postId && confirm('Delete this post?')) {
            await Posts.deletePost(postId);
            if (Router.current.route === 'postDetail') {
                Router.navigate('/feed');
            } else {
                Router.handleRoute();
            }
        }
    }
});
