using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using LeadChatHub.Core.Interfaces;
using LeadChatHub.Infrastructure.Data;

namespace LeadChatHub.Infrastructure.Repositories;

public class GenericRepository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _ctx;
    protected readonly DbSet<T> _dbSet;

    public GenericRepository(AppDbContext ctx)
    {
        _ctx = ctx;
        _dbSet = ctx.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id) => await _dbSet.FindAsync(id);

    public async Task<IEnumerable<T>> GetAllAsync() => await _dbSet.ToListAsync();

    public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        => await _dbSet.Where(predicate).ToListAsync();

    public async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _ctx.SaveChangesAsync();
        return entity;
    }

    public async Task UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _ctx.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var entity = await _dbSet.FindAsync(id);
        if (entity != null)
        {
            _dbSet.Remove(entity);
            await _ctx.SaveChangesAsync();
        }
    }

    public IQueryable<T> Query() => _dbSet.AsQueryable();
}
