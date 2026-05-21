const AMO_DOMAIN  = 'alekseykatanoyy.amocrm.ru';
const PIPELINE_ID = 10871678;

const MOTIVATION_LABELS = {
  income:  'Доход с ИИ-контента',
  brand:   'Личный бренд',
  freedom: 'Работа на себя',
  speed:   'Скорость × 5',
};
const NICHE_LABELS = {
  beauty:     'Бьюти / Салон',
  restaurant: 'Ресторан / Кафе',
  shop:       'Магазин / Ритейл',
  fitness:    'Фитнес / Спорт',
  medical:    'Медицина / Клиника',
  education:  'Образование',
  travel:     'Туризм / Путешествия',
  design:     'Дизайн / Архитектура',
  other:      'Другое',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { name, contact, type, niche, answers = {}, multi = {} } = req.body || {};
  if (!name || !contact) return res.status(400).json({ error: 'name and contact required' });

  const token = process.env.AMO_TOKEN;
  if (!token) return res.status(500).json({ error: 'AMO_TOKEN not set' });

  const h = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };

  const isPhone = /^[+\d\s\-()]{7,}$/.test(contact.trim());

  try {
    // 1. Create contact
    const contactRes = await fetch(`https://${AMO_DOMAIN}/api/v4/contacts`, {
      method: 'POST', headers: h,
      body: JSON.stringify([{
        name,
        custom_fields_values: [{
          field_code: isPhone ? 'PHONE' : 'INSTAGRAM',
          values: [{ value: contact.trim(), enum_code: isPhone ? 'WORK' : 'OTHER' }],
        }],
      }]),
    });
    const contactData = await contactRes.json();
    const contactId   = contactData?._embedded?.contacts?.[0]?.id;

    // 2. Create lead
    const quizType   = type === 'entrepreneur' ? 'Предприниматель' : 'Обычный человек';
    const nicheLabel = NICHE_LABELS[niche || answers.niche] || niche || '—';
    const leadName   = `Квиз — ${quizType} — ${name}`;

    const leadRes = await fetch(`https://${AMO_DOMAIN}/api/v4/leads`, {
      method: 'POST', headers: h,
      body: JSON.stringify([{
        name:        leadName,
        pipeline_id: PIPELINE_ID,
        _embedded: {
          tags:     [{ name: 'Диагностика' }, { name: quizType }],
          contacts: contactId ? [{ id: contactId }] : [],
        },
      }]),
    });
    const leadData = await leadRes.json();

    if (!leadRes.ok) {
      console.error('[lead] AmoCRM error:', JSON.stringify(leadData));
      return res.status(502).json({ error: 'AmoCRM error' });
    }

    const leadId = leadData?._embedded?.leads?.[0]?.id;

    // 3. Note with quiz answers
    if (leadId) {
      const lines = [`Имя: ${name}`, `Контакт: ${contact}`, `Тип: ${quizType}`, ``];

      if (type === 'entrepreneur') {
        lines.push(`Ниша: ${nicheLabel}`);
        if (answers.rev_now)      lines.push(`Выручка сейчас: ${answers.rev_now}`);
        if (answers.rev_goal)     lines.push(`Цель выручки: ${answers.rev_goal}`);
        if (answers.ai_level)     lines.push(`Уровень AI: ${answers.ai_level}/5`);
        if (answers.content_time) lines.push(`Время на контент: ${answers.content_time}`);
        if (answers.blog)         lines.push(`Соцсети: ${answers.blog}`);
      } else {
        lines.push(`Цель: ${MOTIVATION_LABELS[answers.motivation] || answers.motivation || '—'}`);
        if (answers.experience) lines.push(`Опыт с AI: ${answers.experience}`);
        if (answers.income)     lines.push(`Доход сейчас: ${answers.income}`);
        if (answers.time)       lines.push(`Время в день: ${answers.time}`);
        if (answers.audience)   lines.push(`Аудитория: ${answers.audience}`);
      }

      if (multi && Object.keys(multi).length > 0) {
        lines.push(``, `Доп. ответы:`);
        for (const [k, v] of Object.entries(multi)) {
          if (Array.isArray(v) && v.length) lines.push(`  ${k}: ${v.join(', ')}`);
        }
      }

      await fetch(`https://${AMO_DOMAIN}/api/v4/leads/${leadId}/notes`, {
        method: 'POST', headers: h,
        body: JSON.stringify([{ note_type: 'common', params: { text: lines.join('\n') } }]),
      });
    }

    return res.status(200).json({ ok: true, leadId });
  } catch (err) {
    console.error('[lead] error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
