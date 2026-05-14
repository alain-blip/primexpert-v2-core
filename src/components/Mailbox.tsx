import React, { useState } from 'react';
import { Mail, Search, Star, Trash2, Archive, Send, Filter, MoreVertical, Paperclip, ChevronLeft, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

interface Message {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  isRead: boolean;
  category: 'transaction' | 'system' | 'client';
  initials: string;
}

const MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'OACIQ - Direction',
    subject: '[URGENT] Mise à jour des clauses types - Mai 2026',
    preview: 'Bonjour, veuillez prendre note des modifications apportées à la clause 3.4 du mandat exclusif...',
    time: '10:42',
    isRead: false,
    category: 'system',
    initials: 'OA'
  },
  {
    id: '2',
    sender: 'Mathieu Tremblay',
    subject: 'Offre d\'achat - 4522 Rue de la Roche',
    preview: 'Suite à l\'ACM générée hier, mes clients sont prêts à soumettre une promesse d\'achat à 845k...',
    time: 'Hier',
    isRead: true,
    category: 'transaction',
    initials: 'MT'
  },
  {
    id: '3',
    sender: 'Service Centris',
    subject: 'Alerte Match: Nouvelle propriété à Ahuntsic',
    preview: 'Une nouvelle inscription correspond aux critères de votre client "Gagnon". Cliquez pour voir...',
    time: 'Lundi',
    isRead: true,
    category: 'system',
    initials: 'CE'
  }
];

export function Mailbox() {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMessage = MESSAGES.find(m => m.id === selectedId);

  return (
    <div className="h-[calc(100vh-160px)] flex bg-vault rounded-[32px] border border-white/10 shadow-sm overflow-hidden">
      {/* Sidebar List */}
      <div className={cn(
        "w-full lg:w-[400px] border-r border-white/10 flex flex-col",
        selectedId && "hidden lg:flex"
      )}>
        <div className="p-6 border-b border-white/10 bg-white/[0.03]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">{t('MESSAGERIE', 'INBOX')}<span className="text-blue-400">{t(' SYNCHRONISÉE', '_SYNC')}</span></h2>
            <button className="p-2 bg-blue-500 text-white rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('RECHERCHER_ARCHIVES', 'SEARCH_ARCHIVES')}
              className="w-full bg-vault border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[10px] font-black uppercase tracking-widest focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-300" 
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {MESSAGES.map((msg) => (
            <div 
              key={msg.id}
              onClick={() => setSelectedId(msg.id)}
              className={cn(
                "p-6 cursor-pointer transition-all hover:bg-blue-500/10 group relative",
                selectedId === msg.id && "bg-blue-500/10",
                !msg.isRead && "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-600"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/[0.04] rounded flex items-center justify-center text-[10px] font-black italic text-slate-400 group-hover:bg-blue-900 group-hover:text-blue-200 transition-colors">
                    {msg.initials}
                  </div>
                  <span className={cn(
                    "text-xs font-black uppercase tracking-tighter",
                    !msg.isRead ? "text-slate-300" : "text-slate-400"
                  )}>{msg.sender}</span>
                </div>
                <span className="text-[9px] font-black font-mono text-slate-400">{msg.time}</span>
              </div>
              <h4 className={cn(
                "text-sm font-black italic tracking-tighter mb-1",
                !msg.isRead ? "text-blue-300" : "text-slate-300"
              )}>{msg.subject}</h4>
              <p className="text-[10px] text-slate-400 line-clamp-1 font-medium">{msg.preview}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detail View */}
      <div className={cn(
        "flex-1 flex flex-col bg-vault",
        !selectedId && "hidden lg:flex"
      )}>
        <AnimatePresence mode="wait">
          {selectedMessage ? (
            <motion.div 
              key={selectedMessage.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              {/* Header Actions */}
              <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-white/[0.03]">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden p-2 hover:bg-white/[0.04] rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <button className="p-2 hover:bg-vault hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-blue-400 border border-transparent hover:border-white/10">
                      <Archive className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-vault hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-red-500 border border-transparent hover:border-white/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('ID TRANSACTION', 'TRANSACTION ID')}: #XP-2026</span>
                  <button className="px-5 py-2.5 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl hover:bg-blue-800 active:scale-95 transition-all">
                    RÉPONDRE
                  </button>
                </div>
              </div>

              {/* Email Content */}
              <div className="flex-1 overflow-y-auto p-12">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-5 mb-10">
                    <div className="w-16 h-16 bg-blue-900 text-blue-200 rounded-xl flex items-center justify-center text-2xl font-black italic shadow-lg">
                      {selectedMessage.initials}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-slate-300 uppercase">{selectedMessage.sender}</h2>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mt-1">{selectedMessage.time} • {t('VIA PRIMEXPERT_NET', 'VIA PRIMEXPERT_NET')}</p>
                    </div>
                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-slate-300 mb-8 border-l-4 border-blue-600 pl-6 py-2">
                    {selectedMessage.subject}
                  </h1>

                  <div className="prose prose-blue max-w-none text-slate-300 font-medium leading-relaxed italic">
                    <p>{selectedMessage.preview}</p>
                    <p className="mt-6">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <p className="mt-4">
                      Veuillez consulter les documents joints pour plus de détails sur les nouvelles directives de l'OACIQ applicables à partir du trimestre prochain.
                    </p>
                  </div>

                  <div className="mt-12 pt-8 border-t border-white/10">
                    <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/10 border-dashed group cursor-pointer hover:border-blue-300 transition-colors">
                      <div className="p-3 bg-vault rounded-lg shadow-sm">
                        <Paperclip className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight text-slate-300 italic">Mise_a_Jour_OACIQ_2026.pdf</p>
                        <p className="text-[9px] font-bold text-slate-400">PDF • 2.4 MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-10">
              <Inbox className="w-32 h-32 text-slate-400 mb-6" />
              <h3 className="text-4xl font-black italic tracking-tighter uppercase grayscale">{t('Sélectionnez un message', 'Select a message')}</h3>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2">Mode sécurisé chiffré activé</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
