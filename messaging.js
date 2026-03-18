const Messaging = {
    _conversations: [],
    _currentConversation: null,
    _messages: [],
    _unsubscribeConversations: null,
    _unsubscribeMessages: null,
    _totalUnread: 0,

    // Firestore collections:
    // ss_conversations/{convId} - conversation metadata
    //   Fields: { participants: [uid1, uid2], participantNames: {uid: name}, participantPhotos: {uid: url}, participantTmdbIds: {uid: tmdbId}, lastMessage, lastMessageAt, lastMessageBy, unreadCount: {uid: number}, createdAt }
    // ss_conversations/{convId}/messages/{msgId} - individual messages
    //   Fields: { senderId, text, createdAt, readAt }

    // Generate deterministic conversation ID from two UIDs
    getConversationId(uid1, uid2) {
        return [uid1, uid2].sort().join('_');
    },

    // Start listening to all conversations for current user
    listenToConversations() {
        if (!Auth.isVerified() || !db) return;

        // Unsubscribe previous listener
        if (this._unsubscribeConversations) {
            this._unsubscribeConversations();
        }

        const uid = Auth.getUid();
        this._unsubscribeConversations = db.collection('ss_conversations')
            .where('participants', 'array-contains', uid)
            .orderBy('lastMessageAt', 'desc')
            .onSnapshot(snapshot => {
                this._conversations = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Calculate total unread
                this._totalUnread = this._conversations.reduce((sum, conv) => {
                    return sum + (conv.unreadCount?.[uid] || 0);
                }, 0);

                // Update unread badge in nav
                this._updateUnreadBadge();

                // Re-render conversation list if on messages page
                if (Router.current.route === 'messages') {
                    this._renderConversationList();
                }
            }, err => {
                console.error('Conversations listener error:', err);
            });
    },

    // Stop listening
    stopListening() {
        if (this._unsubscribeConversations) {
            this._unsubscribeConversations();
            this._unsubscribeConversations = null;
        }
        if (this._unsubscribeMessages) {
            this._unsubscribeMessages();
            this._unsubscribeMessages = null;
        }
    },

    // Update the unread badge in nav
    _updateUnreadBadge() {
        const badge = document.querySelector('.nav-unread-badge');
        if (!badge) return;
        if (this._totalUnread > 0) {
            badge.style.display = '';
            badge.textContent = this._totalUnread > 99 ? '99+' : this._totalUnread;
        } else {
            badge.style.display = 'none';
        }
    },

    // Open or create a conversation with another verified user
    async openConversation(otherUid, otherName, otherPhotoUrl, otherTmdbId) {
        if (!Auth.isVerified() || !db) return null;

        const uid = Auth.getUid();
        const convId = this.getConversationId(uid, otherUid);

        // Check if conversation exists
        const convDoc = await db.collection('ss_conversations').doc(convId).get();

        if (!convDoc.exists) {
            // Create new conversation
            const profile = Auth.getProfile();
            await db.collection('ss_conversations').doc(convId).set({
                participants: [uid, otherUid],
                participantNames: {
                    [uid]: profile.displayName || 'You',
                    [otherUid]: otherName
                },
                participantPhotos: {
                    [uid]: profile.photoURL || '',
                    [otherUid]: otherPhotoUrl || ''
                },
                participantTmdbIds: {
                    [uid]: profile.tmdbId || null,
                    [otherUid]: otherTmdbId || null
                },
                lastMessage: '',
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageBy: uid,
                unreadCount: { [uid]: 0, [otherUid]: 0 },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        return convId;
    },

    // Listen to messages in a specific conversation
    listenToMessages(convId) {
        if (!Auth.isVerified() || !db) return;

        // Unsubscribe previous message listener
        if (this._unsubscribeMessages) {
            this._unsubscribeMessages();
        }

        this._currentConversation = convId;

        this._unsubscribeMessages = db.collection('ss_conversations').doc(convId)
            .collection('messages')
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                this._messages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Render messages
                this._renderMessages();

                // Mark as read
                this.markAsRead(convId);
            }, err => {
                console.error('Messages listener error:', err);
            });
    },

    // Send a message
    async sendMessage(convId, text) {
        if (!Auth.isVerified() || !db || !text.trim()) return;

        const uid = Auth.getUid();
        text = text.trim();
        if (text.length > 2000) text = text.substring(0, 2000);

        // Get the other participant's UID
        const conv = this._conversations.find(c => c.id === convId);
        const otherUid = conv?.participants?.find(p => p !== uid);

        // Use batch write for atomicity
        const batch = db.batch();

        // Add message
        const msgRef = db.collection('ss_conversations').doc(convId).collection('messages').doc();
        batch.set(msgRef, {
            senderId: uid,
            text: text,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readAt: null
        });

        // Update conversation metadata
        const convRef = db.collection('ss_conversations').doc(convId);
        const updateData = {
            lastMessage: text.length > 100 ? text.substring(0, 100) + '...' : text,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: uid
        };
        // Increment other user's unread count
        if (otherUid) {
            updateData[`unreadCount.${otherUid}`] = firebase.firestore.FieldValue.increment(1);
        }
        batch.update(convRef, updateData);

        await batch.commit();
    },

    // Mark conversation as read for current user
    async markAsRead(convId) {
        if (!Auth.isVerified() || !db) return;
        const uid = Auth.getUid();

        try {
            await db.collection('ss_conversations').doc(convId).update({
                [`unreadCount.${uid}`]: 0
            });
        } catch (err) {
            // Ignore errors (may not have permission if conversation is being created)
        }
    },

    // Get conversation info for a specific conversation
    getConversation(convId) {
        return this._conversations.find(c => c.id === convId) || null;
    },

    // Get the "other" participant info from a conversation
    getOtherParticipant(conversation) {
        if (!conversation) return null;
        const uid = Auth.getUid();
        const otherUid = conversation.participants.find(p => p !== uid);
        return {
            uid: otherUid,
            name: conversation.participantNames?.[otherUid] || 'Unknown',
            photoUrl: conversation.participantPhotos?.[otherUid] || '',
            tmdbId: conversation.participantTmdbIds?.[otherUid] || null
        };
    },

    // Render conversation list in sidebar
    _renderConversationList() {
        const listEl = document.getElementById('conversations-list');
        if (!listEl) return;

        if (this._conversations.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state" style="padding:2rem">
                    <div class="empty-state-icon">💬</div>
                    <p class="empty-state-text">No messages yet</p>
                    <p class="text-tertiary" style="font-size:0.85rem">Start a conversation from someone's profile</p>
                </div>
            `;
            return;
        }

        const uid = Auth.getUid();
        listEl.innerHTML = this._conversations.map(conv => {
            return Components.conversationItem(conv, uid);
        }).join('');
    },

    // Render messages in chat area
    _renderMessages() {
        const messagesEl = document.getElementById('chat-messages');
        if (!messagesEl) return;

        const uid = Auth.getUid();

        if (this._messages.length === 0) {
            messagesEl.innerHTML = `
                <div class="empty-state" style="padding:3rem">
                    <p class="text-secondary">No messages yet. Say hello!</p>
                </div>
            `;
            return;
        }

        messagesEl.innerHTML = this._messages.map(msg => {
            const isSent = msg.senderId === uid;
            return Components.chatMessage(msg, isSent);
        }).join('');

        // Scroll to bottom
        messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    // Initialize chat input handlers
    initChatInput(convId) {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        if (!input || !sendBtn) return;

        const send = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.focus();
            sendBtn.disabled = true;
            try {
                await this.sendMessage(convId, text);
            } catch (err) {
                Components.toast('Failed to send message', 'error');
            }
            sendBtn.disabled = false;
        };

        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        });
    },

    // Block a user
    async blockUser(otherUid) {
        if (!Auth.isVerified() || !db) return;
        try {
            await db.collection('ss_users').doc(Auth.getUid()).update({
                blockedUsers: firebase.firestore.FieldValue.arrayUnion(otherUid)
            });
            Components.toast('User blocked', 'info');
        } catch (err) {
            Components.toast('Failed to block user', 'error');
        }
    },

    // Check if a user is blocked
    isBlocked(otherUid) {
        return Auth.getProfile()?.blockedUsers?.includes(otherUid) || false;
    }
};
