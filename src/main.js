import saju from 'saju-fortune'
import naming from 'naming-house'
import './style.css'

const { analyzeSaju } = saju
const { recommendNames } = naming
const $ = (selector) => document.querySelector(selector)
const form = $('#reading-form')
const result = $('#result')
let mode = 'fortune'
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const elements = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' }
const elementNames = (values) => values.map((value) => elements[value] || value).join(' · ')

function setMode(next) {
  mode = next
  document.querySelectorAll('.tab').forEach((tab) => {
    const selected = tab.dataset.mode === mode
    tab.classList.toggle('active', selected)
    tab.setAttribute('aria-selected', String(selected))
  })
  $('.fortune-field').hidden = mode !== 'fortune'
  $('.naming-fields').hidden = mode !== 'naming'
  form.elements.surname.required = mode === 'naming'
  form.elements.candidates.required = mode === 'naming'
  $('#form-kicker').textContent = mode === 'fortune' ? 'FORTUNE READING' : 'NAMING HOUSE'
  $('#form-title').textContent = mode === 'fortune' ? '당신의 이야기를 들려주세요' : '소중한 이름을 들려주세요'
  $('#form-description').textContent = mode === 'fortune' ? '사주 풀이를 위한 기본 정보를 입력해 주세요.' : '비교하고 싶은 이름 후보와 출생 정보를 입력해 주세요.'
  $('#submit-label').textContent = mode === 'fortune' ? '나의 사주 살펴보기' : '이름 후보 비교하기'
  $('#form-error').textContent = ''
  result.hidden = true
}

document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)))
document.querySelectorAll('[data-mode-link]').forEach((link) => link.addEventListener('click', () => setMode(link.dataset.modeLink)))
$('#reset').addEventListener('click', () => { result.hidden = true; $('#start').scrollIntoView({ behavior: 'smooth' }) })

function parseCandidates(value) {
  const candidates = value.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean)
  if (!candidates.length || candidates.length > 10) throw new Error('이름 후보를 1개 이상, 10개 이하로 입력해 주세요.')
  return candidates.map((text) => {
    const parts = text.split(':').map((s) => s.trim())
    if (parts.length > 2 || !/^[가-힣]{1,3}$/.test(parts[0]) || (parts.length === 2 && !/^[\u4e00-\u9fff]{1,3}$/u.test(parts[1]))) throw new Error('이름은 한글 1~3자, 한자는 서아:瑞雅 형식으로 입력해 주세요.')
    return { givenName: parts[0], ...(parts[1] ? { hanjaName: parts[1] } : {}) }
  })
}

function renderFortune(data, input) {
  const pillars = [['year', '년주'], ['month', '월주'], ['day', '일주'], ['hour', '시주']].map(([key, label]) => {
    const pillar = data.pillars[key]
    return `<div class="pillar"><span>${label}</span><strong>${escape(pillar?.hanja || '—')}</strong><small>${escape(pillar?.label || '시간 미상')}</small></div>`
  }).join('')
  const bars = Object.entries(data.fiveElements).map(([key, value]) => `<div class="element-row"><span>${elements[key]}</span><div class="bar"><i style="width:${value / 8 * 100}%"></i></div><b>${value}</b></div>`).join('')
  return `<div class="result-grid"><article class="result-card"><div class="result-label">THE FOUR PILLARS</div><h3>태어난 순간의 네 기둥</h3><p class="result-muted">${escape(input.birthDate)} · 양력 ${input.birthTime ? `· ${escape(input.birthTime)}` : '· 시간 미상'}</p><div class="pillars">${pillars}</div><p class="result-foot">일간은 <strong>${escape(data.dayMaster.stem)} · ${escape(data.dayMaster.elementKo)}</strong> 기운입니다. 출생지에 따른 경도 보정은 적용하지 않습니다.</p></article><article class="result-card"><div class="result-label">FIVE ELEMENTS</div><h3>나의 오행 분포</h3><div class="element-bars">${bars}</div><p class="result-foot">두드러진 기운 <strong>${escape(elementNames(data.dominantElements))}</strong> &nbsp; · &nbsp; 부족한 기운 <strong>${escape(elementNames(data.weakElements))}</strong></p></article><article class="result-card wide reading-card"><div class="result-label">YOUR READING</div><h3>${escape(data.fortune.label)}, 이렇게 살펴보세요</h3><p class="reading-summary">${escape(data.fortune.summary)}</p><div class="advice">${data.fortune.guidance.map((item) => `<p><span>✳</span> ${escape(item)}</p>`).join('')}</div>${data.limitations.length ? `<p class="limit">${data.limitations.map(escape).join(' ')}</p>` : ''}<p class="limit">사주 계산은 간략화된 방식이며 절기 경계 등에 따라 전문 만세력과 차이가 있을 수 있습니다.</p></article></div>`
}

function renderNaming(data, input) {
  const cards = data.recommendations.map((item) => `<article class="result-card name-result"><div class="name-top"><span class="result-label">NO. ${String(item.rank).padStart(2, '0')}</span><strong>${escape(item.score)}<small> / 100</small></strong></div><h3>${escape(item.fullName)} <small>${escape(item.hanjaName || '')}</small></h3><p class="result-muted">${escape(item.explanation.join(' '))}</p><div class="score-grid"><span>오행 균형 <b>${item.components.elementBalance}</b></span><span>획수 조화 <b>${item.components.strokeHarmony}</b></span><span>발음 흐름 <b>${item.components.soundFlow}</b></span><span>선호 반영 <b>${item.components.preferenceFit}</b></span></div><p class="result-foot">${item.strokeProfile.source === 'korean-stroke-hangul' ? '한자 정보가 부족해 한글 획수 기준으로 분석했습니다.' : `${item.strokeProfile.available ? '한자 필순 횟수 기준이며 강희자전 원획수·81수리 4격과 다릅니다.' : '일부 한자의 획수를 확인하지 못해 해석이 불완전합니다.'} ${input.surnameHanja ? '' : '성씨 한자가 없어 성씨 획수는 반영되지 않았습니다.'}`}</p></article>`).join('')
  return `<div class="name-intro"><span>NAME RECOMMENDATION</span><p>보완을 살펴볼 기운 <strong>${escape(elementNames(data.context.neededElements))}</strong></p><small>${input.birthTime ? '양력 생년월일과 입력한 출생시간 기준' : '출생시간 미상으로 시주를 제외한 참고 결과'} · 출생지 경도 보정 미적용</small></div><div class="result-grid naming-results">${cards}</div><p class="limit">후보 점수는 패키지의 참고 점수이며 이름의 의미나 법적 사용 가능 여부를 보증하지 않습니다.</p>`
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  $('#form-error').textContent = ''
  const values = new FormData(form)
  const input = { birthDate: values.get('birthDate'), birthTime: values.get('birthTime') || undefined, calendar: 'solar', gender: values.get('gender') }
  try {
    if (mode === 'fortune') {
      const data = analyzeSaju(input, { analysisType: 'fortune', fortuneType: values.get('topic') })
      $('#result-title').textContent = '당신의 사주 이야기'
      $('#result-content').innerHTML = renderFortune(data, input)
    } else {
      const surname = values.get('surname').trim()
      const surnameHanja = values.get('surnameHanja').trim()
      if (!/^[가-힣]{1,3}$/.test(surname)) throw new Error('성씨를 한글 1~3자로 입력해 주세요.')
      if (surnameHanja && !/^[\u4e00-\u9fff]{1,3}$/u.test(surnameHanja)) throw new Error('성씨 한자를 확인해 주세요.')
      const data = await recommendNames({ ...input, surname, ...(surnameHanja ? { surnameHanja } : {}), candidates: parseCandidates(values.get('candidates')) })
      $('#result-title').textContent = '소중한 이름 이야기'
      $('#result-content').innerHTML = renderNaming(data, { ...input, surnameHanja })
    }
    result.hidden = false
    result.scrollIntoView({ behavior: 'smooth', block: 'start' })
    result.focus({ preventScroll: true })
  } catch (error) {
    $('#form-error').textContent = error.message || '결과를 계산하지 못했습니다. 입력을 확인해 주세요.'
  }
})
