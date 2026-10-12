import styles from './Steps.module.css'
import ApplyIcon from '../../assets/Icons/Apply.svg?react'
import RulerIcon from '../../assets/Icons/Ruler.svg?react'
import PencilIcon from '../../assets/Icons/Pencil.svg?react'
import CalculatorIcon from '../../assets/Icons/Calculator.svg?react'
import WorkIcon from '../../assets/Icons/Work.svg?react'
import FinishIcon from '../../assets/Icons/Finish.svg?react'
export const Steps = () => {
    const Steps = [
        {
            id: 1,
            icon: <ApplyIcon className={styles['icon']} />,
            number: '01',
            title: 'Դիմում',
            description: 'Հաճախորդը ներկայացնում է հայտ: Քննարկում ենք ձեր նախագիծը, կարիքները, ժամկետը:'
        },
        {
            id: 2,
            icon: <RulerIcon />,
            number: '02',
            title: 'Չափագրում',
            description: 'Գեոդեզիական և ճարտարապետական չափագրումներ, հողամասի կամ շինության ճշգրիտ հանույթ։'
        },
        {
            id: 3,
            icon: <PencilIcon />,
            number: '03',
            title: 'Նախագծում',
            description: 'Ճարտարապետական և ինժեներական նախագծերի մշակում, հաղորդակցուղիների և կառուցվածքային լուծումների նախագծում։'
        },
        {
            id: 4,
            icon: <CalculatorIcon />,
            number: '04',
            title: 'Նախահաշիվ',
            description: 'Ծախսերի մանրամասն նախահաշիվ, ժամանակացույց, պայմանագրի կնքում:'
        },
        {
            id: 5,
            icon: <WorkIcon />,
            number: '05',
            title: 'Իրականացում',
            description: 'Շինարարություն, վերանորոգում կամ կահավորում՝ ըստ հաստատված նախագծի:'
        },
        {
            id: 6,
            icon: <FinishIcon />,
            number: '06',
            title: 'Հանձնում',
            description: 'Աշխատանքների հանձնում, փաստաթղթերի փաթեթ և երաշխիքային պայմաններ։'
        },
    ]
    return (
        <section className={styles["steps"]} aria-labelledby="process-title">
            <div className={styles["steps-header"]}>
                <p className={styles['steps-title']}>Աշխատանքի ընթացք</p>
                <h2 id="process-title" className={styles["steps-subtitle"]}>Ինչպես ենք մենք աշխատում</h2>
                <p className={styles['steps-text']}>6 հստակ փուլ՝ ձեր նախագծի ամբողջական իրականացման համար:</p>
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