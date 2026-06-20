import React from 'react';
import PartnerSelectModal from '../../components/PartnerSelectModal';

interface MonsterStatusProps {
    onBack: () => void;
}

const MonsterStatus: React.FC<MonsterStatusProps> = ({ onBack }) => {
    return (
        <PartnerSelectModal
            isOpen={true}
            onClose={onBack}
        />
    );
};

export default MonsterStatus;
