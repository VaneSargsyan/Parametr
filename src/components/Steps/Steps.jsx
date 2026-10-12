import { useTranslation } from 'react-i18next';
import styles from './Steps.module.css'
import ApplyIcon from '../../assets/Icons/Apply.svg?react'
import RulerIcon from '../../assets/Icons/Ruler.svg?react'
import PencilIcon from '../../assets/Icons/Pencil.svg?react'
import CalculatorIcon from '../../assets/Icons/Calculator.svg?react'
import WorkIcon from '../../assets/Icons/Work.svg?react'
import FinishIcon from '../../assets/Icons/Finish.svg?react'
export const Steps = () => {
    const { t } = useTranslation();
    const Steps = [
        {
            id: 1,
            icon: <ApplyIcon className={styles['icon']} />,
            number: '01',
            title: t('process.steps.inquiry.title'),
            description: t('process.steps.inquiry.description')
        },
        {
            id: 2,
            icon: <RulerIcon />,
            number: '02',
            title: t('process.steps.survey.title'),
            description: t('process.steps.survey.description')
        },
        {
            id: 3,
            icon: <PencilIcon />,
            number: '03',
            title: t('process.steps.design.title'),
            description: t('process.steps.design.description')
        },
        {
            id: 4,
            icon: <CalculatorIcon />,
            number: '04',
            title: t('process.steps.estimate.title'),
            description: t('process.steps.estimate.description')
        },
        {
            id: 5,
            icon: <WorkIcon />,
            number: '05',
            title: t('process.steps.execution.title'),
            description: t('process.steps.execution.description')
        },
        {
            id: 6,
            icon: <FinishIcon />,
            number: '06',
            title: t('process.steps.handover.title'),
            description: t('process.steps.handover.description')
        },
    ]
    return (
        <section className={styles["steps"]} aria-labelledby="process-title">
            <div className={styles["steps-header"]}>
                <p className={styles['steps-title']}>{t('process.eyebrow')}</p>
                <h2 id="process-title" className={styles["steps-subtitle"]}>{t('process.title')}</h2>
                <p className={styles['steps-text']}>{t('process.description')}</p>
            </div>
            <ol className={styles["steps-main"]}>
                {Steps.map((item) => (
                    <li className={styles['step-item']} key={item.id}>
                        <div className={styles["step-header"]}>
                            <span aria-hidden="true" className={styles['icon']}>{item.icon}</span>
                            <p className={styles['number']}>{item.number}</p>
                        </div>
                        <h3 className={styles['step-title']}>{item.title}</h3>
                        <p className={styles['step-desc']}>{item.description}</p>
                    </li>
                ))}
            </ol>
        </section>
    )
}