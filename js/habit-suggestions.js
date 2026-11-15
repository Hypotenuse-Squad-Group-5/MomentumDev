/* Optional AI assistance; choosing a suggestion never saves a lesson. */
window.HabitSuggestions = {
  mount(form, lessonNumber) {
    const button = form.querySelector('#suggest-habits');
    const goal = form.querySelector('#goal');
    const habit = form.querySelector('#habit');
    const consent = form.querySelector('#ai-consent');
    const status = form.querySelector('#ai-status');
    const list = form.querySelector('#habit-suggestions');
    const finish = form.querySelector('button[type="submit"]');
    let pending = false, revision = 0;
    const clear = () => { revision++; consent.checked = false; list.replaceChildren(); status.textContent = ''; };
    goal.addEventListener('input', clear);
    consent.addEventListener('change', () => { revision++; list.replaceChildren(); status.textContent = ''; });
    button.addEventListener('click', async () => {
      if (pending) return;
      const reflection = goal.value.trim();
      if (!reflection || goal.value.length > 1000) {
        status.textContent = 'Write a reflection of up to 1,000 characters first.'; goal.focus(); return;
      }
      if (!consent.checked) { status.textContent = 'Confirm your reflection contains no personal or sensitive information first.'; consent.focus(); return; }
      const requestRevision = revision;
      pending = true; button.disabled = true; button.textContent = 'Suggesting…';
      list.replaceChildren(); status.textContent = 'Finding three small habits you could try…';
      try {
        const cfg = window.MOMENTUM_CONFIG;
        if (!cfg?.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error('AI suggestions need a connected account. You can still write your own habit.');
        const session = await Store.auth.session();
        if (!session?.access_token) throw new Error('Sign in to request suggestions.');
        if (requestRevision !== revision) return;
        const response = await fetch(`${cfg.SUPABASE_URL}/functions/v1/suggest-habits`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ lessonNumber, reflection, consent: true }), signal: AbortSignal.timeout(25000)
        });
        const result = await response.json();
        if (requestRevision !== revision) return;
        if (!response.ok) throw new Error(result.message || 'Suggestions are unavailable. You can still write your own habit.');
        if (!Array.isArray(result.suggestions) || result.suggestions.length !== 3 || result.suggestions.some(s => typeof s !== 'string' || !s.trim() || s.length > 80)) throw new Error('Suggestions could not be used. You can still write your own habit.');
        result.suggestions.forEach(text => {
          const choice = document.createElement('button');
          choice.type = 'button'; choice.className = 'btn habit-suggestion'; choice.textContent = text;
          choice.addEventListener('click', () => {
            habit.value = text;
            habit.dispatchEvent(new Event('input', { bubbles: true }));
            habit.closest('.field').classList.remove('invalid');
            form.querySelector('#habit-error').hidden = true;
            list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === choice)));
            status.textContent = 'Habit selected. Edit it if you like, then finish the lesson.';
            habit.focus();
          });
          choice.setAttribute('aria-pressed', 'false'); list.append(choice);
        });
        status.textContent = 'Choose a suggestion to fill your habit, or write your own.';
      } catch (error) {
        if (requestRevision === revision) status.textContent = error.name === 'TimeoutError' ? 'Suggestions took too long. Try again or write your own habit.' : (error.message || 'Suggestions are unavailable. You can still write your own habit.');
      } finally {
        pending = false; button.disabled = finish.disabled; button.textContent = 'Suggest habits with AI';
      }
    });
  }
};
