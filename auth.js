// ═══════════════════════════════════════════════════
// auth.js — Módulo compartilhado de autenticação
// Usado por todas as páginas do sistema
// ═══════════════════════════════════════════════════

const Auth = {
  // Get Supabase config
  getConfig() {
    return {
      url: (localStorage.getItem('sb_url') || 'https://evvnxwfwzixslrfzyfir.supabase.co').replace(/\/$/, ''),
      key: localStorage.getItem('sb_key') || 'sb_publishable_woGJwyHN2N6LiksFAlVYag_2guzXHZZ'
    };
  },

  // Get current session
  getSession() {
    try {
      return JSON.parse(localStorage.getItem('sb_session'));
    } catch(e) {
      return null;
    }
  },

  // Get user info
  getUser() {
    const s = this.getSession();
    return s?.user || null;
  },

  getUserName() {
    const u = this.getUser();
    return u?.user_metadata?.name || u?.email?.split('@')[0] || 'Estudante';
  },

  // Check if logged in, redirect if not
  requireAuth() {
    if (!this.getSession()?.access_token) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  // Headers for Supabase REST API
  headers(token) {
    const cfg = this.getConfig();
    return {
      'Content-Type': 'application/json',
      'apikey': cfg.key,
      'Authorization': `Bearer ${token || this.getSession()?.access_token || cfg.key}`,
      'Prefer': 'return=representation'
    };
  },

  // Logout
  logout() {
    const cfg = this.getConfig();
    const session = this.getSession();
    
    // Call Supabase logout (fire and forget)
    if (cfg.url && session?.access_token) {
      fetch(`${cfg.url}/auth/v1/logout`, {
        method: 'POST',
        headers: this.headers()
      }).catch(() => {});
    }

    localStorage.removeItem('sb_session');
    window.location.href = 'login.html';
  },

  // Refresh token if needed
  async refreshToken() {
    const cfg = this.getConfig();
    const session = this.getSession();
    if (!session?.refresh_token) return false;

    try {
      const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.key
        },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('sb_session', JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user
        }));
        return true;
      }
    } catch(e) {}

    return false;
  }
};

// ═══════════════════════════════════════════════════
// DB — Database operations (Supabase REST API)
// ═══════════════════════════════════════════════════

const DB = {
  async request(method, table, params = {}) {
    const cfg = Auth.getConfig();
    if (!cfg.url) return null;

    let url = `${cfg.url}/rest/v1/${table}`;
    
    // Add query params for GET
    if (params.query) {
      url += '?' + params.query;
    }

    const options = {
      method,
      headers: Auth.headers()
    };

    if (params.body) {
      options.body = JSON.stringify(params.body);
    }

    // For upsert
    if (params.upsert) {
      options.headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    }

    try {
      const res = await fetch(url, options);
      
      // If 401, try refresh
      if (res.status === 401) {
        const refreshed = await Auth.refreshToken();
        if (refreshed) {
          options.headers = Auth.headers();
          const retry = await fetch(url, options);
          if (retry.ok) return retry.json();
        }
        Auth.logout();
        return null;
      }

      if (res.ok) {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      }
      
      console.error('DB error:', res.status, await res.text());
      return null;
    } catch(e) {
      console.error('DB connection error:', e);
      return null;
    }
  },

  // ── Notes ──
  async getNotes(userId) {
    return this.request('GET', 'study_notes', {
      query: `user_id=eq.${userId}&select=*`
    });
  },

  async getNote(userId, chapter) {
    const data = await this.request('GET', 'study_notes', {
      query: `user_id=eq.${userId}&chapter=eq.${chapter}&select=*`
    });
    return data?.[0] || null;
  },

  async saveNote(userId, chapter, content) {
    return this.request('POST', 'study_notes', {
      body: { user_id: userId, chapter, content, updated_at: new Date().toISOString() },
      upsert: true
    });
  },

  // ── AI Responses ──
  async getAIResponse(userId, chapter) {
    const data = await this.request('GET', 'ai_responses', {
      query: `user_id=eq.${userId}&chapter=eq.${chapter}&order=created_at.desc&limit=1&select=*`
    });
    return data?.[0] || null;
  },

  async saveAIResponse(userId, chapter, responseType, content) {
    return this.request('POST', 'ai_responses', {
      body: {
        user_id: userId,
        chapter,
        response_type: responseType,
        content,
        created_at: new Date().toISOString()
      }
    });
  },

  // ── Flashcards ──
  async getFlashcards(userId, chapter) {
    return this.request('GET', 'flashcards', {
      query: `user_id=eq.${userId}&chapter=eq.${chapter}&select=*`
    });
  },

  async saveFlashcards(userId, chapter, cards) {
    // Delete old flashcards for this chapter
    await this.request('DELETE', 'flashcards', {
      query: `user_id=eq.${userId}&chapter=eq.${chapter}`
    });

    // Insert new ones
    const rows = cards.map(c => ({
      user_id: userId,
      chapter,
      question: c.q,
      answer: c.a
    }));

    return this.request('POST', 'flashcards', { body: rows });
  }
};
