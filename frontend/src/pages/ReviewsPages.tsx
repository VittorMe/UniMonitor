import { useQuery } from '@tanstack/react-query';

import { formatWhen, monitorApi, type Review } from '@/features/domain/api';

export const ReviewCard = ({ review, showAuthor }: { review: Review; showAuthor?: boolean }) => {
  const authorLabel = showAuthor && review.author
    ? `${review.author.name}${review.author.registration ? ` · ${review.author.registration}` : ''}`
    : review.author?.name ?? (review.isAnonymous ? 'Aluno anonimo' : 'Aluno identificado');

  return (
    <article className="review-card">
      <header>
        <strong>{review.sessionTitle}</strong>
        <span className="badge">⭐ {review.rating}</span>
      </header>
      <p className="muted">
        {review.subject} · {formatWhen(review.createdAt)}
      </p>
      <p className="review-scores">
        Clareza {review.clarity} · Pontualidade {review.punctuality} · Dominio {review.mastery}
      </p>
      {review.comment ? <p>{review.comment}</p> : null}
      {review.commentHidden ? <p className="muted">Comentario privado (visivel so para o professor da disciplina).</p> : null}
      <p className="muted">{authorLabel}</p>
    </article>
  );
};

export const MonitorReviewsPage = () => {
  const list = useQuery({ queryKey: ['monitor-reviews'], queryFn: monitorApi.reviews });
  return (
    <section className="page">
      <h1>Meu feedback</h1>
      <p className="muted">O nome do aluno so aparece se ele tiver escolhido se identificar.</p>
      {list.data?.map((review) => (
        <ReviewCard key={review.id} review={review} showAuthor />
      ))}
      {list.data?.length === 0 && <p className="muted">Voce ainda nao recebeu avaliacoes.</p>}
    </section>
  );
};
