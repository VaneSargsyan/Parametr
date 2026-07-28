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
            description: 'Գեոդեզիական և ճարտ. չափագրումներ, հողի կամ շինության ճշգրիտ հանույթ:'
        },
        {
            id: 3,
            icon: <PencilIcon />,
            number: '03',
            title: 'Նախագծում',
            description: 'Ճարտ. և ճարտ. ծրագրերի մշակում, կոմունիկացիոն և կոնստրուկտիվ լուծումներ:'
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
            description: 'Հանձնում, փաստ. փաթեթ, երաշխիքային պայմաններ:'
        },
    ]
    console.log(ApplyIcon)
    return (
        <div className={styles["steps"]}>
            <div className={styles["steps-header"]}>
                <h3 className={styles['steps-title']}>Աշխատանքի Ընթացք</h3>
                <h2 className={styles["steps-subtitle"]}>Ինչպես ենք մենք աշխատում</h2>
                <p className={styles['steps-text']}>6 հստակ փուլ՝ ձեր նախագծի ամբողջական իրականացման համար:</p>
            </div>
            <div className={styles["steps-main"]}>
                {Steps.map((item) => (
                    <div className={styles['step-item']} key={item.id}>
                        <div className={styles["step-header"]}>
                            <span className={styles['icon']}>{item.icon}</span>
                            <p className={styles['number']}>{item.number}</p>
                        </div>
                        <h3 className={styles['step-title']}>{item.title}</h3>
                        <p className={styles['step-desc']}>{item.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}