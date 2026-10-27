import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BadgeState } from '../types'

// The band reads ~/.claude/debriefs/state.json, which the /debriefs skill (or the
// daily "debriefs-check" scheduled task) writes after every check. The mod has no
// network of its own: it only draws what the last check found.

const badge = atom({ plugin: 'hion-debriefs', key: 'badge' } as const, null as BadgeState | null)
const isHidden = atom({ plugin: 'hion-debriefs', key: 'isHidden' } as const, false)

const TEN_MINUTES = 10 * 60 * 1000

async function readState($: any): Promise<BadgeState | null> {
  const home = await $.env.get('HOME')
  if (!home) return null
  const path = `${home}/.claude/debriefs/state.json`
  if (!(await $.fs.exists(path))) return null
  try {
    const parsed = JSON.parse(await $.fs.read(path))
    return {
      checkedAt: typeof parsed.checked_at === 'string' ? parsed.checked_at : null,
      openDebriefs: Number(parsed.open_debriefs) || 0,
      openQuestions: Number(parsed.open_questions) || 0,
    }
  } catch {
    return null
  }
}

async function refresh($: any): Promise<void> {
  const next = await readState($)
  const prev = await read($, badge)
  // A new count un-hides the band; "Hide" only silences the count it was shown for.
  if (next && (!prev || prev.openQuestions !== next.openQuestions)) {
    await update($, isHidden, () => false)
  }
  await update($, badge, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($)
    $.clock.every(TEN_MINUTES, () => refresh($))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, badge)
    const hidden = await read($, isHidden)
    if (e.props.hasSurvey || hidden || !state || state.openQuestions === 0) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const questions =
      state.openQuestions === 1 ? '1 debrief question' : `${state.openQuestions} debrief questions`
    const debriefs = state.openDebriefs === 1 ? '1 debrief' : `${state.openDebriefs} debriefs`

    return (
      <Box>
        <Text>
          {questions} waiting ({debriefs}) · /debriefs{' '}
        </Text>
        <Button
          key="answer"
          label="Answer now"
          onPress={() => {
            void $.prompt.submit({ text: '/debriefs answer' })
          }}
        />
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
