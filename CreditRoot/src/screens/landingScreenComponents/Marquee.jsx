import { useTranslation } from 'react-i18next'

function Marquee() {
    const { t } = useTranslation()
    const items = [
        t('landing.marquee.usdc'), t('landing.marquee.cetes'),
        t('landing.marquee.soroban'), t('landing.marquee.custody'),
        t('landing.marquee.etherfuse'), t('landing.marquee.stellar'),
        t('landing.marquee.comisiones'),
    ]
    const loop = [...items, ...items]

    return (
        <div className="border-y border-ink/8 dark:border-white/8 bg-cream dark:bg-white/5 py-4 overflow-hidden">
            <div className="flex gap-12 whitespace-nowrap animate-marquee">
                {loop.map((item, i) => (
                    <span key={i} className="text-sm font-medium text-ink/40 dark:text-white/40 flex items-center gap-3 shrink-0">
                        {item} <span className="text-brand text-xs">✦</span>
                    </span>
                ))}
            </div>
        </div>
    )
}
export default Marquee