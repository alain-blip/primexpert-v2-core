import React from 'react';
import { Users, Mail, Phone, Tag, ChevronRight, UserPlus, FileDown } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

export function CRM() {
  const { t } = useLanguage();
  const contacts = [
    { id: 1, name: "Jean Tremblay", type: "Vendeur", email: "jean@tremblay.com", phone: "514-555-0101", status: "Chaud", initials: "JT" },
    { id: 2, name: "Sophie Martin", type: "Acheteur", email: "sophie.m@gmail.com", phone: "438-555-0202", status: "Actif", initials: "SM" },
    { id: 3, name: "Marc-André Roy", type: "Collaborateur", email: "roy@immobilier.ca", phone: "450-555-0303", status: "Partenaire", initials: "MR" },
    { id: 4, name: "Lucie Gagnon", type: "Vendeur", email: "lg@videotron.ca", phone: "514-555-0404", status: "Froid", initials: "LG" },
    { id: 5, name: "Pierre Lefebvre", type: "Acheteur", email: "pierre.le@outlook.com", phone: "514-555-0505", status: "Nouveau", initials: "PL" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Chaud': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Actif': return 'bg-green-100 text-green-700 border-green-200';
      case 'Partenaire': return 'bg-blue-100 text-blue-300 border-blue-200';
      case 'Nouveau': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-black italic text-gray-900 tracking-tighter uppercase">RÉPERTOIRE<span className="text-blue-400">_CRM</span></h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{t('Traçabilité conforme et suivi CRM', 'Compliant traceability & CRM pipeline')}</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 bg-vault rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm">
            <FileDown className="w-4 h-4" />
            Exporter CSV
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 hover:scale-105 active:scale-95 transition-all">
            <UserPlus className="w-4 h-4" />
            Nouv. Contact
          </button>
        </div>
      </div>

      <div className="bg-vault rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-gray-100">
          <div className="bg-gray-50 px-8 py-3 grid grid-cols-1 md:grid-cols-4 gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <div className="md:col-span-1">Nom / Type</div>
            <div className="md:col-span-1">Coordonnées</div>
            <div className="md:col-span-1">{t('Statut du suivi', 'Pipeline Status')}</div>
            <div className="md:col-span-1 text-right">Actions</div>
          </div>
          {contacts.map((contact, i) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center px-8 py-5 hover:bg-blue-50/30 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-blue-900 text-blue-300 rounded-lg flex items-center justify-center font-black italic text-lg mr-8 shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                {contact.initials}
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div>
                  <h4 className="text-sm font-black text-gray-900 tracking-tight">{contact.name}</h4>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">{contact.type}</p>
                </div>
                
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 truncate">
                    <Mail className="w-3 h-3 text-blue-400" />
                    <span>{contact.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-900 font-mono tracking-tighter">
                    <Phone className="w-3 h-3 text-blue-400" />
                    <span>{contact.phone}</span>
                  </div>
                </div>

                <div className="flex items-center">
                   <span className={cn(
                     "px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                     getStatusColor(contact.status)
                   )}>
                     {contact.status}
                   </span>
                </div>

                <div className="flex justify-end">
                   <div className="p-2 rounded-lg bg-gray-50 text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                     <ChevronRight className="w-4 h-4" />
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
