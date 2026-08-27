'use strict'

const SELECT_IDS = [
    'output-resolution',
    'output-audio',
    'output-fit',
    'output-duration',
    'output-pad',
]

let openRoot = null
let typeahead = ''
let typeaheadTimer = null

function selectedLabel(select) {
    const option = select.options[select.selectedIndex]
    return option ? option.textContent : ''
}

function closeOpenSelect() {
    if (openRoot && openRoot._tesselSelect) {
        openRoot._tesselSelect.close()
    }
}

function enhanceSelect(select) {
    if (select.dataset.enhanced === '1') {
        return
    }
    select.dataset.enhanced = '1'

    const field = select.closest('.output-field')
    const label = field ? field.querySelector('.output-field-label') : null
    if (label && !label.id) {
        label.id = select.id + '-label'
    }

    const root = document.createElement('div')
    root.className = 'select'
    select.parentNode.insertBefore(root, select)
    root.appendChild(select)
    select.classList.add('select-native', 'sr')
    select.setAttribute('tabindex', '-1')
    select.setAttribute('aria-hidden', 'true')

    const listId = select.id + '-list'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'select-trigger'
    trigger.id = select.id + '-trigger'
    trigger.setAttribute('role', 'combobox')
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', listId)
    if (label) {
        trigger.setAttribute('aria-labelledby', label.id + ' ' + select.id + '-value')
    }

    const valueEl = document.createElement('span')
    valueEl.className = 'select-value'
    valueEl.id = select.id + '-value'
    trigger.appendChild(valueEl)

    const chevron = document.createElement('span')
    chevron.className = 'select-chevron'
    chevron.setAttribute('aria-hidden', 'true')
    chevron.innerHTML = '<svg class="hi" width="16" height="16" focusable="false"><use href="#hi-arrow-down-01"/></svg>'
    trigger.appendChild(chevron)

    const list = document.createElement('div')
    list.className = 'select-list'
    list.id = listId
    list.setAttribute('role', 'listbox')
    list.setAttribute('tabindex', '-1')
    if (label) {
        list.setAttribute('aria-labelledby', label.id)
    }
    if (typeof list.showPopover === 'function') {
        list.setAttribute('popover', 'manual')
    } else {
        list.hidden = true
    }

    root.appendChild(trigger)
    root.appendChild(list)

    let activeIndex = 0

    function optionElements() {
        return Array.from(select.options)
    }

    function setActive(index, scroll) {
        const items = list.querySelectorAll('[role="option"]')
        if (!items.length) {
            return
        }
        activeIndex = Math.max(0, Math.min(index, items.length - 1))
        items.forEach(function (item, i) {
            const on = i === activeIndex
            item.classList.toggle('is-active', on)
            if (on) {
                trigger.setAttribute('aria-activedescendant', item.id)
                if (scroll) {
                    item.scrollIntoView({ block: 'nearest' })
                }
            }
        })
    }

    function renderOptions() {
        list.replaceChildren()
        optionElements().forEach(function (opt, index) {
            const item = document.createElement('div')
            item.className = 'select-option'
            item.id = select.id + '-option-' + index
            item.setAttribute('role', 'option')
            item.setAttribute('aria-selected', opt.selected ? 'true' : 'false')
            const text = document.createElement('span')
            text.className = 'select-option-label'
            text.textContent = opt.textContent
            text.title = opt.textContent
            item.appendChild(text)
            if (opt.selected) {
                item.classList.add('is-selected')
                const check = document.createElement('span')
                check.className = 'select-option-check'
                check.setAttribute('aria-hidden', 'true')
                check.innerHTML = '<svg class="hi" width="14" height="14" focusable="false"><use href="#hi-tick-02"/></svg>'
                item.appendChild(check)
            }
            item.addEventListener('pointerenter', function () {
                setActive(index, false)
            })
            item.addEventListener('pointerdown', function (event) {
                event.preventDefault()
                choose(index)
            })
            list.appendChild(item)
        })
        valueEl.textContent = selectedLabel(select)
        valueEl.title = valueEl.textContent
        setActive(select.selectedIndex >= 0 ? select.selectedIndex : 0, false)
    }

    function positionList() {
        const rect = trigger.getBoundingClientRect()
        const maxHeight = 220
        const spaceBelow = window.innerHeight - rect.bottom - 8
        const spaceAbove = rect.top - 8
        const estimated = Math.min(list.scrollHeight || maxHeight, maxHeight)
        const openUp = spaceBelow < estimated && spaceAbove > spaceBelow
        const available = Math.max(72, Math.min(maxHeight, openUp ? spaceAbove : spaceBelow))
        list.style.maxHeight = available + 'px'
        list.style.width = rect.width + 'px'
        list.style.minWidth = rect.width + 'px'
        list.style.left = rect.left + 'px'
        if (openUp) {
            list.style.top = 'auto'
            list.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
        } else {
            list.style.top = (rect.bottom + 4) + 'px'
            list.style.bottom = 'auto'
        }
        root.classList.toggle('select-up', openUp)
    }

    function isOpen() {
        return root.classList.contains('is-open')
    }

    function open() {
        if (openRoot && openRoot !== root) {
            openRoot._tesselSelect.close()
        }
        renderOptions()
        if (typeof list.showPopover === 'function') {
            try {
                if (!list.matches(':popover-open')) {
                    list.showPopover()
                }
            } catch (err) {
                list.hidden = false
            }
        } else {
            list.hidden = false
        }
        root.classList.add('is-open')
        trigger.setAttribute('aria-expanded', 'true')
        positionList()
        setActive(select.selectedIndex >= 0 ? select.selectedIndex : 0, true)
        openRoot = root
    }

    function close() {
        if (openRoot === root) {
            openRoot = null
        }
        root.classList.remove('is-open')
        trigger.setAttribute('aria-expanded', 'false')
        trigger.removeAttribute('aria-activedescendant')
        if (typeof list.hidePopover === 'function' && list.matches(':popover-open')) {
            try {
                list.hidePopover()
            } catch (err) {
                list.hidden = true
            }
        }
        if (!list.hasAttribute('popover')) {
            list.hidden = true
        }
    }

    function choose(index) {
        const opt = select.options[index]
        if (!opt) {
            return
        }
        if (select.value !== opt.value) {
            select.value = opt.value
            select.dispatchEvent(new Event('change', { bubbles: true }))
        }
        renderOptions()
        close()
        trigger.focus()
    }

    function moveTypeahead(character) {
        typeahead += character.toLowerCase()
        clearTimeout(typeaheadTimer)
        typeaheadTimer = setTimeout(function () {
            typeahead = ''
        }, 500)
        const opts = optionElements()
        const start = isOpen() ? activeIndex + 1 : 0
        for (let i = 0; i < opts.length; i++) {
            const index = (start + i) % opts.length
            if (opts[index].textContent.toLowerCase().indexOf(typeahead) === 0) {
                if (!isOpen()) {
                    open()
                }
                setActive(index, true)
                return
            }
        }
    }

    trigger.addEventListener('click', function (event) {
        event.preventDefault()
        if (isOpen()) {
            close()
        } else {
            open()
        }
    })

    trigger.addEventListener('keydown', function (event) {
        const opts = optionElements()
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!isOpen()) {
                open()
                return
            }
            setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1), true)
            return
        }
        if (event.key === 'Home' && isOpen()) {
            event.preventDefault()
            setActive(0, true)
            return
        }
        if (event.key === 'End' && isOpen()) {
            event.preventDefault()
            setActive(opts.length - 1, true)
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!isOpen()) {
                open()
            } else {
                choose(activeIndex)
            }
            return
        }
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
        }
        if (event.key === 'Tab' && isOpen()) {
            close()
            return
        }
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            moveTypeahead(event.key)
        }
    })

    if (label) {
        label.addEventListener('click', function () {
            trigger.focus()
        })
    }

    new MutationObserver(function () {
        renderOptions()
        if (isOpen()) {
            positionList()
        }
    }).observe(select, { childList: true, subtree: true, characterData: true })

    select.addEventListener('change', function () {
        renderOptions()
    })

    window.addEventListener('resize', function () {
        if (isOpen()) {
            positionList()
        }
    })

    root._tesselSelect = {
        sync: renderOptions,
        close: close,
        contains: function (node) {
            return root.contains(node) || list.contains(node)
        },
    }
    renderOptions()
}

document.addEventListener('pointerdown', function (event) {
    if (!openRoot || !openRoot._tesselSelect) {
        return
    }
    if (openRoot._tesselSelect.contains(event.target)) {
        return
    }
    closeOpenSelect()
}, true)

document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !openRoot) {
        return
    }
    event.preventDefault()
    event.stopPropagation()
    const trigger = openRoot.querySelector('.select-trigger')
    closeOpenSelect()
    if (trigger) {
        trigger.focus()
    }
}, true)

function enhanceOutputSelects() {
    SELECT_IDS.forEach(function (id) {
        const el = document.getElementById(id)
        if (el) {
            enhanceSelect(el)
        }
    })
}

function syncSelectFace(select) {
    const root = select && select.closest ? select.closest('.select') : null
    if (root && root._tesselSelect) {
        root._tesselSelect.sync()
    }
}

function syncSelectFaces() {
    SELECT_IDS.forEach(function (id) {
        const el = document.getElementById(id)
        if (el) {
            syncSelectFace(el)
        }
    })
}

window.enhanceOutputSelects = enhanceOutputSelects
window.syncSelectFace = syncSelectFace
window.syncSelectFaces = syncSelectFaces
window.closeOutputSelects = closeOpenSelect

enhanceOutputSelects()
