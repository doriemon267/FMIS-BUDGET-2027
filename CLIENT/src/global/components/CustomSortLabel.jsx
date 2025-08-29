import { FaAngleUp, FaAngleDown } from "react-icons/fa6";
// Custom Sort Icon Component
const CustomSortLabel = (props) => {
    const { direction } = props;

    return (
        <>
            {direction === 'asc' ? (
                <FaAngleUp style={{ color: 'white' }} />
            ) : (
                <FaAngleDown style={{ color: 'white' }} />
            )}
            {props.children}
        </>
    );
};

export default CustomSortLabel;